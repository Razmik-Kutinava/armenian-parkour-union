import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { memberships } from '../../db/schema/payments';
import { testDb, testDbUrl } from '../../db/test-db';
import type { LimitDb } from '../../auth/rate-limit';
import { auditFor } from '../memberships/test-support';
import { applyForCard } from './card-apply';
import { decideCard, type CardDecisionInput } from './card-decision';
import { cardDeps as deps, cardRow, IP, mailbox, SITE, staff, volunteer } from './test-support';

/* docs/03 section 19.1 pp. 2–5, 19.9; docs/05 section 28 "Cards": only an admin decides; issue
 * checks the conditions again; reasons are required; the letter waits for the commit. */

const NUMBER = /^APU-V-(\d{4})-(\d{4,})$/;

async function pending(tx: LimitDb, values: Parameters<typeof volunteer>[1] = {}) {
	const user = await volunteer(tx, values);
	const result = await applyForCard(tx, user.id, deps(mailbox().send));
	if (!result.ok) throw new Error(result.reason);
	return { user, id: result.id };
}

describe.skipIf(!testDbUrl)('volunteer card: issue, reject, revoke', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('issue: active, a number and a token, audited without the token, a letter to the member', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const { user, id } = await pending(tx, { firstName: 'Ani', locale: 'ru' });
			const mail = mailbox();
			expect(await decideCard(tx, admin, id, { action: 'issue' }, deps(mail.send))).toEqual({
				ok: true
			});
			const row = await cardRow(tx, id);
			const year = new Date().toLocaleString('en-US', { year: 'numeric', timeZone: 'Asia/Yerevan' });
			expect(row).toMatchObject({ status: 'active', reviewedBy: admin.id, reviewNote: null });
			expect(row.number).toMatch(NUMBER);
			expect(row.number?.slice(6, 10)).toBe(year);
			expect(row.publicToken).toMatch(/^[\w-]{32}$/);
			expect(row.issuedAt).toBeInstanceOf(Date);
			const [entry] = await auditFor(tx, 'volunteer_card', id);
			expect(entry).toMatchObject({
				actorId: admin.id,
				action: 'volunteer_card.issue',
				ip: IP,
				before: { status: 'pending' },
				after: { status: 'active', userId: user.id, number: row.number }
			});
			expect(JSON.stringify(entry)).not.toContain(row.publicToken!);
			expect(mail.sent).toHaveLength(1);
			expect(mail.sent[0].to).toBe(user.email);
			expect(mail.sent[0].text).toContain(row.number!);
			expect(mail.sent[0].text).toContain(`${SITE}/ru/cabinet/volunteer`);
		});
	});

	it('numbers go one after another; a new issue keeps the number and changes the token', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const a = await pending(tx);
			const b = await pending(tx);
			const decide = (id: string, input: CardDecisionInput) =>
				decideCard(tx, admin, id, input, deps(mailbox().send));
			await decide(a.id, { action: 'issue' });
			await decide(b.id, { action: 'issue' });
			const [first, second] = [await cardRow(tx, a.id), await cardRow(tx, b.id)];
			const seq = (n: string | null) => Number(NUMBER.exec(n ?? '')?.[2]);
			expect(seq(second.number)).toBe(seq(first.number) + 1);
			await decide(a.id, { action: 'revoke', reason: 'Ошибка выдачи' });
			await applyForCard(tx, a.user.id, deps(mailbox().send));
			await decide(a.id, { action: 'issue' });
			const again = await cardRow(tx, a.id);
			expect(again.number).toBe(first.number);
			expect(again.publicToken).not.toBe(first.publicToken);
		});
	});

	it('issue checks the conditions again: membership gone — what is missing, nothing changes', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const { user, id } = await pending(tx);
			await tx.delete(memberships).where(eq(memberships.userId, user.id));
			const mail = mailbox();
			expect(await decideCard(tx, admin, id, { action: 'issue' }, deps(mail.send))).toEqual({
				ok: false,
				reason: 'conditions',
				missing: ['membership']
			});
			expect((await cardRow(tx, id)).status).toBe('pending');
			expect(await auditFor(tx, 'volunteer_card', id)).toHaveLength(0);
			expect(mail.sent).toHaveLength(0);
		});
	});

	it('reject and revoke: the reason is required, stored, audited and sent to the member', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const { user, id } = await pending(tx);
			const mail = mailbox();
			const decide = (input: CardDecisionInput) => decideCard(tx, admin, id, input, deps(mail.send));
			for (const reason of ['', '   ', 'x'.repeat(1001)]) {
				expect(await decide({ action: 'reject', reason })).toEqual({ ok: false, reason: 'invalid' });
			}
			expect(await decide({ action: 'reject', reason: ' Нужно фото без очков ' })).toEqual({
				ok: true
			});
			expect(await cardRow(tx, id)).toMatchObject({
				status: 'rejected',
				reviewNote: 'Нужно фото без очков',
				reviewedBy: admin.id
			});
			expect(mail.sent[0].to).toBe(user.email);
			expect(mail.sent[0].text).toContain('Нужно фото без очков');
			await applyForCard(tx, user.id, deps(mailbox().send));
			await decide({ action: 'issue' });
			expect(await decide({ action: 'revoke', reason: '' })).toEqual({
				ok: false,
				reason: 'invalid'
			});
			expect(await decide({ action: 'revoke', reason: 'Нарушение кодекса' })).toEqual({ ok: true });
			expect((await cardRow(tx, id)).status).toBe('revoked');
			expect(mail.sent.at(-1)?.text).toContain('Нарушение кодекса');
			const actions = (await auditFor(tx, 'volunteer_card', id)).map((e) => e.action);
			expect(actions).toEqual([
				'volunteer_card.reject',
				'volunteer_card.issue',
				'volunteer_card.revoke'
			]);
		});
	});

	it('only from the right status: issue and reject a pending card, revoke an active one', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const { id } = await pending(tx);
			const decide = (input: CardDecisionInput) =>
				decideCard(tx, admin, id, input, deps(mailbox().send));
			const badState = { ok: false, reason: 'bad_state' };
			expect(await decide({ action: 'revoke', reason: 'Рано' })).toEqual(badState);
			await decide({ action: 'issue' });
			expect(await decide({ action: 'issue' })).toEqual(badState);
			expect(await decide({ action: 'reject', reason: 'Поздно' })).toEqual(badState);
			await decide({ action: 'revoke', reason: 'Нарушение' });
			expect(await decide({ action: 'revoke', reason: 'Ещё раз' })).toEqual(badState);
			expect(await decide({ action: 'issue' })).toEqual(badState);
		});
	});

	it('not an admin, an unknown card; a failing mail service does not undo the decision', async () => {
		await inRollback(async (tx) => {
			const { id } = await pending(tx);
			for (const role of ['moderator', 'editor', 'member'] as const) {
				const actor = await staff(tx, role);
				expect(await decideCard(tx, actor, id, { action: 'issue' }, deps(mailbox().send))).toEqual({
					ok: false,
					reason: 'not_allowed'
				});
			}
			const admin = await staff(tx);
			const notFound = { ok: false, reason: 'not_found' };
			const send = mailbox(true).send;
			expect(await decideCard(tx, admin, crypto.randomUUID(), { action: 'issue' }, deps(send))).toEqual(
				notFound
			);
			expect(await decideCard(tx, admin, 'nope', { action: 'issue' }, deps(send))).toEqual(notFound);
			expect((await cardRow(tx, id)).status).toBe('pending');
			expect(await decideCard(tx, admin, id, { action: 'issue' }, deps(send))).toEqual({ ok: true });
			expect((await cardRow(tx, id)).status).toBe('active');
		});
	});
});
