import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { testDb, testDbUrl } from '../../db/test-db';
import { consents } from '../../db/schema/consents';
import { users } from '../../db/schema/users';
import { perkRedemptions } from '../../db/schema/volunteer-cards';
import {
	partnerCashiers,
	volunteerPartners,
	volunteerPerks
} from '../../db/schema/volunteer-partners';
import { applyForCard } from './card-apply';
import { decideCard } from './card-decision';
import { findPublicCard } from './card-public';
import {
	cardRow,
	cardDeps as deps,
	insertPrivacy,
	mailbox,
	partnerValues,
	perkValues,
	staff,
	volunteer
} from './test-support';

/* docs/06 section 4.12, docs/03 sections 19.2–19.3, 13 p. 5: what anyone with the QR sees. Valid —
 * photo, name, number, "valid until", visible perks; not valid — the number only; unknown — 404. */

const LATER = new Date(Date.now() + 400 * 86_400_000);

async function issued(tx: LimitDb, values: Parameters<typeof volunteer>[1] = {}) {
	const admin = await staff(tx);
	const user = await volunteer(tx, { firstName: 'Aram', lastName: 'Petrosyan', ...values });
	const applied = await applyForCard(tx, user.id, deps(mailbox().send));
	if (!applied.ok) throw new Error(applied.reason);
	await decideCard(tx, admin, applied.id, { action: 'issue' }, deps(mailbox().send));
	const row = await cardRow(tx, applied.id);
	return { admin, userId: user.id, cardId: applied.id, token: row.publicToken!, row };
}

const notValid = (number: string | null) => ({ valid: false, number });

describe.skipIf(!testDbUrl)('volunteer card check page', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('valid: photo, name, number, valid until and the visible perks — nothing else', async () => {
		await inRollback(async (tx) => {
			const { admin, cardId, token, row } = await issued(tx);
			const [partner] = await tx
				.insert(volunteerPartners)
				.values(partnerValues({ status: 'published' }))
				.returning({ id: volunteerPartners.id });
			const perk = async (extra: Parameters<typeof perkValues>[0]) =>
				(
					await tx
						.insert(volunteerPerks)
						.values({ ...perkValues({ status: 'published', ...extra }), partnerId: partner.id })
						.returning({ id: volunteerPerks.id })
				)[0].id;
			const open = await perk({});
			const used = await perk({ kind: 'single', usesLimit: 1 });
			const hidden = await perk({ status: 'draft' });
			const [till] = await tx
				.insert(partnerCashiers)
				.values({ partnerId: partner.id, label: 'Till', createdBy: admin.id })
				.returning({ id: partnerCashiers.id });
			await tx
				.insert(perkRedemptions)
				.values({ cardId, perkId: used, partnerId: partner.id, cashierId: till.id });

			const card = await findPublicCard(tx, token);
			expect(card).toMatchObject({
				valid: true,
				number: row.number,
				holder: 'Aram Petrosyan',
				avatarKey: expect.stringMatching(/^avatars\//)
			});
			if (!card?.valid) throw new Error('not valid');
			expect(card.validUntil).toBeInstanceOf(Date);
			const mine = card.partners.find((p) => p.id === partner.id);
			expect(mine?.perks.map((p) => p.id)).toEqual([open]);
			expect(mine?.perks.map((p) => p.id)).not.toContain(used);
			expect(mine?.perks.map((p) => p.id)).not.toContain(hidden);
			expect(Object.keys(card).sort()).toEqual(
				['avatarKey', 'holder', 'number', 'partners', 'valid', 'validUntil'].sort()
			);
		});
	});

	it('a partner whose only perk is used up is not listed', async () => {
		await inRollback(async (tx) => {
			const { admin, cardId, token } = await issued(tx);
			const [partner] = await tx
				.insert(volunteerPartners)
				.values(partnerValues({ status: 'published' }))
				.returning({ id: volunteerPartners.id });
			const [perk] = await tx
				.insert(volunteerPerks)
				.values({
					...perkValues({ status: 'published', kind: 'single', usesLimit: 1 }),
					partnerId: partner.id
				})
				.returning({ id: volunteerPerks.id });
			const [till] = await tx
				.insert(partnerCashiers)
				.values({ partnerId: partner.id, label: 'Till', createdBy: admin.id })
				.returning({ id: partnerCashiers.id });
			await tx
				.insert(perkRedemptions)
				.values({ cardId, perkId: perk.id, partnerId: partner.id, cashierId: till.id });
			const card = await findPublicCard(tx, token);
			if (!card?.valid) throw new Error('not valid');
			expect(card.partners.some((p) => p.id === partner.id)).toBe(false);
		});
	});

	it('not valid — the number only: revoked, membership over, blocked, deleted', async () => {
		await inRollback(async (tx) => {
			const { admin, userId, cardId, token, row } = await issued(tx);
			expect(await findPublicCard(tx, token, LATER)).toEqual(notValid(row.number));

			await tx.update(users).set({ status: 'blocked' }).where(eq(users.id, userId));
			expect(await findPublicCard(tx, token)).toEqual(notValid(row.number));
			await tx.update(users).set({ status: 'active', deletedAt: new Date() }).where(eq(users.id, userId));
			expect(await findPublicCard(tx, token)).toEqual(notValid(row.number));
			await tx.update(users).set({ deletedAt: null }).where(eq(users.id, userId));
			expect((await findPublicCard(tx, token))?.valid).toBe(true);

			await decideCard(
				tx,
				admin,
				cardId,
				{ action: 'revoke', reason: 'Hidden reason' },
				deps(mailbox().send)
			);
			const revoked = await findPublicCard(tx, token);
			expect(revoked).toEqual(notValid(row.number));
			expect(JSON.stringify(revoked)).not.toContain('Hidden reason');
		});
	});

	it('under 18: valid with the privacy consent, without it — the number only', async () => {
		await inRollback(async (tx) => {
			const birthDate = `${new Date().getUTCFullYear() - 15}-01-01`;
			const minor = await volunteer(tx, { birthDate });
			await insertPrivacy(tx, minor.id);
			const admin = await staff(tx);
			const applied = await applyForCard(tx, minor.id, deps(mailbox().send));
			if (!applied.ok) throw new Error(applied.reason);
			await decideCard(tx, admin, applied.id, { action: 'issue' }, deps(mailbox().send));
			const row = await cardRow(tx, applied.id);
			const token = row.publicToken!;
			expect(await findPublicCard(tx, token)).toMatchObject({ valid: true, number: row.number });

			await tx.delete(consents).where(eq(consents.userId, minor.id));
			const card = await findPublicCard(tx, token);
			expect(card).toEqual(notValid(row.number));
			expect(JSON.stringify(card)).not.toContain(birthDate);
		});
	});

	it('unknown, broken, too long or an old token after a new issue — null (404)', async () => {
		await inRollback(async (tx) => {
			const { admin, userId, cardId, token } = await issued(tx);
			for (const bad of ['', 'nope', 'a b', 'x'.repeat(65), `${token}/`]) {
				expect(await findPublicCard(tx, bad), bad).toBeNull();
			}
			await decideCard(tx, admin, cardId, { action: 'revoke', reason: 'r' }, deps(mailbox().send));
			const again = await applyForCard(tx, userId, deps(mailbox().send));
			if (!again.ok) throw new Error(again.reason);
			await decideCard(tx, admin, cardId, { action: 'issue' }, deps(mailbox().send));
			const fresh = (await cardRow(tx, cardId)).publicToken!;
			expect(fresh).not.toBe(token);
			expect(await findPublicCard(tx, token)).toBeNull();
			expect((await findPublicCard(tx, fresh))?.valid).toBe(true);
		});
	});
});
