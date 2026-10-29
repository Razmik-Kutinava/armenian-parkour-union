import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { users } from '../../db/schema/users';
import { volunteerCards } from '../../db/schema/volunteer-cards';
import { testDb, testDbUrl } from '../../db/test-db';
import { auditFor } from '../memberships/test-support';
import { applyForCard } from './card-apply';
import { decideCard } from './card-decision';
import {
	cardDeps as deps,
	cardRow,
	mailbox,
	setFederationEmail,
	SITE,
	staff,
	volunteer
} from './test-support';

/* docs/03 section 19.1 pp. 1, 5; letters — 19.9 p. 2. Applying is not audited (19.9 p. 1). */

const OFFICE = 'office@parkour.test';
const refused = (reason: string) => ({ ok: false, reason });

describe.skipIf(!testDbUrl)('volunteer card: a request from the cabinet', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a member who meets the conditions applies: pending, a letter to the federation, no audit', async () => {
		await inRollback(async (tx) => {
			await setFederationEmail(tx, OFFICE);
			const user = await volunteer(tx, { firstName: 'Aram', lastName: 'Petrosyan' });
			const mail = mailbox();
			const before = Date.now();
			const result = await applyForCard(tx, user.id, deps(mail.send));
			if (!result.ok) throw new Error(result.reason);
			const row = await cardRow(tx, result.id);
			expect(row).toMatchObject({ userId: user.id, status: 'pending', number: null });
			expect(row.appliedAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
			expect(mail.sent).toHaveLength(1);
			expect(mail.sent[0].to).toBe(OFFICE);
			expect(mail.sent[0].text).toContain('Aram Petrosyan');
			expect(mail.sent[0].text).toContain(`${SITE}/admin/volunteer/cards/${result.id}`);
			expect(await auditFor(tx, 'volunteer_card', result.id)).toHaveLength(0);
		});
	});

	it('conditions not met: the missing ones come back, no row, no letter', async () => {
		await inRollback(async (tx) => {
			await setFederationEmail(tx, OFFICE);
			const user = await volunteer(tx, {
				member: false,
				emailVerified: false,
				avatarKey: null,
				birthDate: '2012-03-03'
			});
			const mail = mailbox();
			expect(await applyForCard(tx, user.id, deps(mail.send))).toEqual({
				ok: false,
				reason: 'conditions',
				missing: ['email', 'membership', 'photo', 'privacy']
			});
			const rows = await tx.select().from(volunteerCards).where(eq(volunteerCards.userId, user.id));
			expect(rows).toHaveLength(0);
			expect(mail.sent).toHaveLength(0);
		});
	});

	it('a blocked member is refused; an unknown or deleted one is not found', async () => {
		await inRollback(async (tx) => {
			const send = mailbox().send;
			const blocked = await volunteer(tx, { status: 'blocked' });
			expect(await applyForCard(tx, blocked.id, deps(send))).toEqual(refused('blocked'));
			const gone = await volunteer(tx);
			await tx.update(users).set({ deletedAt: new Date() }).where(eq(users.id, gone.id));
			expect(await applyForCard(tx, gone.id, deps(send))).toEqual(refused('not_found'));
			expect(await applyForCard(tx, crypto.randomUUID(), deps(send))).toEqual(refused('not_found'));
			expect(await applyForCard(tx, 'nope', deps(send))).toEqual(refused('not_found'));
		});
	});

	it('pending or active cannot apply again; rejected and revoked return the same row to pending', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const user = await volunteer(tx);
			const again = () => applyForCard(tx, user.id, deps(mailbox().send));
			const first = await again();
			if (!first.ok) throw new Error(first.reason);
			expect(await again()).toEqual(refused('bad_state'));
			const decide = (input: Parameters<typeof decideCard>[3]) =>
				decideCard(tx, admin, first.id, input, deps(mailbox().send));
			expect(await decide({ action: 'reject', reason: 'Фото не по форме' })).toEqual({ ok: true });
			expect(await again()).toEqual({ ok: true, id: first.id });
			expect(await cardRow(tx, first.id)).toMatchObject({
				status: 'pending',
				reviewedBy: null,
				reviewedAt: null,
				reviewNote: null
			});
			expect(await decide({ action: 'issue' })).toEqual({ ok: true });
			const issued = await cardRow(tx, first.id);
			expect(await again()).toEqual(refused('bad_state'));
			expect(await decide({ action: 'revoke', reason: 'Нарушение кодекса' })).toEqual({ ok: true });
			expect(await again()).toEqual({ ok: true, id: first.id });
			expect(await cardRow(tx, first.id)).toMatchObject({
				status: 'pending',
				number: issued.number,
				reviewNote: null
			});
		});
	});

	it('no federation address or a failing mail service does not undo the request', async () => {
		await inRollback(async (tx) => {
			await setFederationEmail(tx, null);
			const quiet = mailbox();
			const one = await volunteer(tx);
			expect((await applyForCard(tx, one.id, deps(quiet.send))).ok).toBe(true);
			expect(quiet.sent).toHaveLength(0);
			await setFederationEmail(tx, OFFICE);
			const two = await volunteer(tx);
			expect((await applyForCard(tx, two.id, deps(mailbox(true).send))).ok).toBe(true);
		});
	});
});
