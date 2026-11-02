import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { testDb, testDbUrl } from '../../db/test-db';
import { perkRedemptions } from '../../db/schema/volunteer-cards';
import { volunteerPerks } from '../../db/schema/volunteer-partners';
import { applyForCard } from './card-apply';
import { bindCashier, findCashier } from './cashier-access';
import { decideCard } from './card-decision';
import { createCashier, disableCashier } from './cashiers-admin';
import { markPerk } from './perk-mark';
import { createPartner } from './partners-admin';
import {
	cardDeps as deps,
	cardRow,
	IP,
	mailbox,
	partnerValues,
	perkValues,
	staff,
	volunteer
} from './test-support';

/* docs/03 section 19.4, docs/04 section 8: only this partner's cashier on a valid card; single
 * perks decrement; double mark within a minute is one row; wrong partner or perk — refused;
 * spoofed token / disabled access — refused. */

async function issued(tx: LimitDb) {
	const admin = await staff(tx);
	const user = await volunteer(tx);
	const applied = await applyForCard(tx, user.id, deps(mailbox().send));
	if (!applied.ok) throw new Error(applied.reason);
	await decideCard(tx, admin, applied.id, { action: 'issue' }, deps(mailbox().send));
	const row = await cardRow(tx, applied.id);
	return { admin, cardId: applied.id, token: row.publicToken! };
}

async function boundCashier(
	tx: LimitDb,
	admin: Awaited<ReturnType<typeof staff>>,
	partnerId: string
) {
	const created = await createCashier(tx, admin, partnerId, 'Till', null);
	if (typeof created === 'string') throw new Error(created);
	const device = await bindCashier(tx, created.token);
	const cashier = await findCashier(tx, device);
	if (!cashier) throw new Error('no cashier');
	return cashier;
}

describe.skipIf(!testDbUrl)('cashier marks a perk', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('reusable: inserts a redemption and updates last_used_at', async () => {
		await inRollback(async (tx) => {
			const { admin, cardId, token } = await issued(tx);
			const partner = await createPartner(tx, admin, partnerValues({ status: 'published' }), null);
			if (typeof partner === 'string') throw new Error(partner);
			const [perk] = await tx
				.insert(volunteerPerks)
				.values({ ...perkValues({ status: 'published' }), partnerId: partner.id })
				.returning({ id: volunteerPerks.id });
			const cashier = await boundCashier(tx, admin, partner.id);

			const result = await markPerk(tx, token, cashier, partner.id, perk.id);
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.duplicate).toBeUndefined();
			const rows = await tx
				.select()
				.from(perkRedemptions)
				.where(eq(perkRedemptions.cardId, cardId));
			expect(rows).toHaveLength(1);
			expect(rows[0]).toMatchObject({
				perkId: perk.id,
				partnerId: partner.id,
				cashierId: cashier.id,
				reversalOfId: null
			});
		});
	});

	it('single: second mark when uses are gone — no_uses_left', async () => {
		await inRollback(async (tx) => {
			const { admin, token } = await issued(tx);
			const partner = await createPartner(tx, admin, partnerValues({ status: 'published' }), null);
			if (typeof partner === 'string') throw new Error(partner);
			const [perk] = await tx
				.insert(volunteerPerks)
				.values({
					...perkValues({ status: 'published', kind: 'single', usesLimit: 1 }),
					partnerId: partner.id
				})
				.returning({ id: volunteerPerks.id });
			const cashier = await boundCashier(tx, admin, partner.id);
			expect((await markPerk(tx, token, cashier, partner.id, perk.id)).ok).toBe(true);
			expect(await markPerk(tx, token, cashier, partner.id, perk.id)).toEqual({
				ok: false,
				reason: 'no_uses_left'
			});
		});
	});

	it('within a minute the same mark is idempotent', async () => {
		await inRollback(async (tx) => {
			const { admin, cardId, token } = await issued(tx);
			const partner = await createPartner(tx, admin, partnerValues({ status: 'published' }), null);
			if (typeof partner === 'string') throw new Error(partner);
			const [perk] = await tx
				.insert(volunteerPerks)
				.values({ ...perkValues({ status: 'published' }), partnerId: partner.id })
				.returning({ id: volunteerPerks.id });
			const cashier = await boundCashier(tx, admin, partner.id);
			const first = await markPerk(tx, token, cashier, partner.id, perk.id);
			const second = await markPerk(tx, token, cashier, partner.id, perk.id);
			expect(second).toMatchObject({ ok: true, duplicate: true });
			if (!first.ok || !second.ok) return;
			expect(second.redemptionId).toBe(first.redemptionId);
			expect(
				await tx.select().from(perkRedemptions).where(eq(perkRedemptions.cardId, cardId))
			).toHaveLength(1);
		});
	});

	it('wrong partner, unknown perk or invalid card — refused', async () => {
		await inRollback(async (tx) => {
			const { admin, cardId, token } = await issued(tx);
			const partner = await createPartner(tx, admin, partnerValues({ status: 'published' }), null);
			if (typeof partner === 'string') throw new Error(partner);
			const other = await createPartner(tx, admin, partnerValues({ status: 'published' }), null);
			if (typeof other === 'string') throw new Error(other);
			const [perk] = await tx
				.insert(volunteerPerks)
				.values({ ...perkValues({ status: 'published' }), partnerId: partner.id })
				.returning({ id: volunteerPerks.id });
			const cashier = await boundCashier(tx, admin, partner.id);

			expect(await markPerk(tx, token, cashier, other.id, perk.id)).toEqual({
				ok: false,
				reason: 'wrong_partner'
			});
			expect(await markPerk(tx, token, cashier, partner.id, crypto.randomUUID())).toEqual({
				ok: false,
				reason: 'perk_unavailable'
			});
			await decideCard(
				tx,
				admin,
				cardId,
				{ action: 'revoke', reason: 'test' },
				deps(mailbox().send)
			);
			expect(await markPerk(tx, token, cashier, partner.id, perk.id)).toEqual({
				ok: false,
				reason: 'invalid_card'
			});
		});
	});

	it('spoofed card token or disabled cashier — refused, no row', async () => {
		await inRollback(async (tx) => {
			const { admin, cardId, token } = await issued(tx);
			const partner = await createPartner(tx, admin, partnerValues({ status: 'published' }), null);
			if (typeof partner === 'string') throw new Error(partner);
			const [perk] = await tx
				.insert(volunteerPerks)
				.values({ ...perkValues({ status: 'published' }), partnerId: partner.id })
				.returning({ id: volunteerPerks.id });
			const cashier = await boundCashier(tx, admin, partner.id);

			expect(
				await markPerk(tx, crypto.randomUUID().replaceAll('-', ''), cashier, partner.id, perk.id)
			).toEqual({ ok: false, reason: 'not_found' });
			expect(await markPerk(tx, `${token}/`, cashier, partner.id, perk.id)).toEqual({
				ok: false,
				reason: 'bad_request'
			});

			expect(await disableCashier(tx, admin, partner.id, cashier.id, IP)).toBe('ok');
			expect(await markPerk(tx, token, cashier, partner.id, perk.id)).toEqual({
				ok: false,
				reason: 'cashier_gone'
			});
			expect(
				await tx.select().from(perkRedemptions).where(eq(perkRedemptions.cardId, cardId))
			).toHaveLength(0);
		});
	});
});
