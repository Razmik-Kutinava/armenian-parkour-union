import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { readListState } from '#lib/components/admin/list-state.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { volunteerCards } from '../../db/schema/volunteer-cards';
import { testDb, testDbUrl } from '../../db/test-db';
import { applyForCard } from './card-apply';
import { decideCard, type CardDecisionInput } from './card-decision';
import { cardDetail, cardFilter, cardListOptions, listCards } from './cards-admin';
import { cardDeps as deps, cardRow, insertPrivacy, mailbox, staff, volunteer } from './test-support';

/* docs/05 section 28 "Cards": the queue (pending, oldest first), filters by status, flag and
 * validity, search by name, number and email; the card for the decision. */

const filterOf = (query: string) =>
	cardFilter(readListState(new URLSearchParams(query), cardListOptions));

async function card(tx: LimitDb, name: string, values: Parameters<typeof volunteer>[1] = {}) {
	const user = await volunteer(tx, { name, ...values });
	const result = await applyForCard(tx, user.id, deps(mailbox().send));
	if (!result.ok) throw new Error(result.reason);
	return { user, id: result.id };
}

describe.skipIf(!testDbUrl)('volunteer cards in the admin panel', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('filters from the URL: unknown status — the queue; all, flagged, valid yes / no', () => {
		expect(filterOf('')).toMatchObject({ status: 'pending', flagged: false, valid: null });
		expect(filterOf('status=hacked')).toMatchObject({ status: 'pending' });
		expect(filterOf('status=all&flagged=1&valid=no')).toMatchObject({
			status: 'all',
			flagged: true,
			valid: 'no'
		});
		expect(filterOf('status=revoked&valid=maybe')).toMatchObject({ status: 'revoked', valid: null });
	});

	it('the queue: pending only, oldest first; search by name, number and email', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const tag = crypto.randomUUID().slice(0, 8);
			const old = await card(tx, `Vol ${tag} Old`);
			await tx
				.update(volunteerCards)
				.set({ appliedAt: new Date(Date.now() - 86_400_000) })
				.where(eq(volunteerCards.id, old.id));
			const fresh = await card(tx, `Vol ${tag} Fresh`);
			const done = await card(tx, `Vol ${tag} Done`);
			await decideCard(tx, admin, done.id, { action: 'issue' }, deps(mailbox().send));
			const queue = await listCards(tx, { ...filterOf(''), q: `Vol ${tag}` });
			expect(queue.rows.map((r) => r.id)).toEqual([old.id, fresh.id]);
			expect(queue.total).toBe(2);
			const { number } = await cardRow(tx, done.id);
			const byNumber = await listCards(tx, { ...filterOf('status=all'), q: number! });
			expect(byNumber.rows.map((r) => r.id)).toEqual([done.id]);
			const byEmail = await listCards(tx, { ...filterOf('status=all'), q: fresh.user.email });
			expect(byEmail.rows.map((r) => r.id)).toEqual([fresh.id]);
		});
	});

	it('validity: yes with the paid end, no with the reasons; the filter agrees with the column', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const tag = crypto.randomUUID().slice(0, 8);
			const decide = (id: string, input: CardDecisionInput) =>
				decideCard(tx, admin, id, input, deps(mailbox().send));
			const good = await card(tx, `Vol ${tag} Good`);
			const kid = await volunteer(tx, { name: `Vol ${tag} Kid`, birthDate: '2012-01-01' });
			await insertPrivacy(tx, kid.id, new Date(Date.now() + 86_400_000));
			const kidCard = await applyForCard(tx, kid.id, deps(mailbox().send));
			if (!kidCard.ok) throw new Error(kidCard.reason);
			const gone = await card(tx, `Vol ${tag} Gone`);
			for (const id of [good.id, kidCard.id, gone.id]) await decide(id, { action: 'issue' });
			await decide(gone.id, { action: 'revoke', reason: 'Нарушение' });
			const later = new Date(Date.now() + 2 * 86_400_000);
			const all = await listCards(tx, { ...filterOf('status=all'), q: `Vol ${tag}` }, later);
			const byId = new Map(all.rows.map((r) => [r.id, r]));
			expect(byId.get(good.id)?.validity).toMatchObject({ valid: true });
			expect(byId.get(good.id)?.paidUntil).toBeInstanceOf(Date);
			expect(byId.get(kidCard.id)?.validity).toEqual({ valid: false, reasons: ['privacy'] });
			expect(byId.get(kidCard.id)?.age).toBeLessThan(18);
			expect(byId.get(gone.id)?.validity).toEqual({ valid: false, reasons: ['status'] });
			const yes = await listCards(tx, { ...filterOf('status=all&valid=yes'), q: `Vol ${tag}` }, later);
			expect(yes.rows.map((r) => r.id)).toEqual([good.id]);
			const no = await listCards(tx, { ...filterOf('status=all&valid=no'), q: `Vol ${tag}` }, later);
			expect(no.rows.map((r) => r.id).sort()).toEqual([kidCard.id, gone.id].sort());
		});
	});

	it('flagged: only cards with the mark, the streak shown', async () => {
		await inRollback(async (tx) => {
			const tag = crypto.randomUUID().slice(0, 8);
			const calm = await card(tx, `Vol ${tag} Calm`);
			const loud = await card(tx, `Vol ${tag} Loud`);
			await tx
				.update(volunteerCards)
				.set({ declineStreak: 3, flaggedAt: new Date() })
				.where(eq(volunteerCards.id, loud.id));
			const flagged = await listCards(tx, { ...filterOf('flagged=1'), q: `Vol ${tag}` });
			expect(flagged.rows).toMatchObject([{ id: loud.id, declineStreak: 3, flagged: true }]);
			const queue = await listCards(tx, { ...filterOf(''), q: `Vol ${tag}` });
			expect(queue.rows.find((r) => r.id === calm.id)).toMatchObject({ flagged: false });
		});
	});

	it('the card: member, photo key, decision, validity and the check page token; unknown — null', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const { user, id } = await card(tx, 'Vol Card');
			await decideCard(tx, admin, id, { action: 'issue' }, deps(mailbox().send));
			const row = await cardRow(tx, id);
			const detail = await cardDetail(tx, id);
			expect(detail).toMatchObject({
				id,
				status: 'active',
				number: row.number,
				publicToken: row.publicToken,
				member: { id: user.id, name: 'Vol Card', email: user.email, age: expect.any(Number) },
				validity: { valid: true }
			});
			expect(detail?.member.avatarKey).toMatch(/^avatars\//);
			expect(detail?.reviewerName).toEqual(expect.any(String));
			expect(await cardDetail(tx, crypto.randomUUID())).toBeNull();
			expect(await cardDetail(tx, 'nope')).toBeNull();
		});
	});
});
