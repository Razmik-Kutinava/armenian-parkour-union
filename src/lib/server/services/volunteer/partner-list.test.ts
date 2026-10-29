import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { partnerCashiers, volunteerPerks } from '../../db/schema/volunteer-partners';
import { perkRedemptions, volunteerCards } from '../../db/schema/volunteer-cards';
import { auditFor } from '../memberships/test-support';
import type { Actor } from '../users/target';
import { listPartnersAdmin } from './partner-list';
import { movePartner } from './partner-order';
import { createPartner } from './partners-admin';
import { partnerValues, perkValues, staff } from './test-support';

/* docs/05 section 28 "Partners": list in sort_order with published perks, active cashier accesses
 * and uses in 30 days; order by ↑ / ↓ (audited). */

const DAY = 24 * 60 * 60 * 1000;

async function newPartner(tx: LimitDb, actor: Actor) {
	const created = await createPartner(tx, actor, partnerValues(), null);
	if (typeof created === 'string') throw new Error(created);
	return created.id;
}

describe.skipIf(!testDbUrl)('volunteer partners: list and order', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('counts: published perks, bound and enabled cashiers, marks in 30 days without a reversal', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const partnerId = await newPartner(tx, admin);
			const perks = await tx
				.insert(volunteerPerks)
				.values([
					{ ...perkValues({ status: 'published' }), partnerId },
					{ ...perkValues({ status: 'published' }), partnerId },
					{ ...perkValues({ status: 'draft' }), partnerId },
					{ ...perkValues({ status: 'archived' }), partnerId }
				])
				.returning({ id: volunteerPerks.id });
			const now = new Date();
			const cashier = (extra: Partial<typeof partnerCashiers.$inferInsert>) => ({
				partnerId,
				label: 'Till',
				createdBy: admin.id,
				...extra
			});
			const [till] = await tx
				.insert(partnerCashiers)
				.values([
					cashier({ boundAt: now, deviceTokenHash: crypto.randomUUID() }),
					cashier({ boundAt: now, disabledAt: now, deviceTokenHash: crypto.randomUUID() }),
					cashier({ inviteTokenHash: crypto.randomUUID(), inviteExpiresAt: now })
				])
				.returning({ id: partnerCashiers.id });
			const { id: userId } = await insertUser(tx);
			const [card] = await tx
				.insert(volunteerCards)
				.values({ userId, appliedAt: now })
				.returning({ id: volunteerCards.id });
			const mark = (createdAt: Date) => ({
				cardId: card.id,
				perkId: perks[0].id,
				partnerId,
				cashierId: till.id,
				createdAt
			});
			const marks = await tx
				.insert(perkRedemptions)
				.values([mark(now), mark(now), mark(new Date(now.getTime() - 40 * DAY))])
				.returning({ id: perkRedemptions.id });
			await tx.insert(perkRedemptions).values({
				cardId: card.id,
				perkId: perks[0].id,
				partnerId,
				reversalOfId: marks[1].id,
				comment: 'Mistake',
				createdBy: admin.id
			});
			const row = (await listPartnersAdmin(tx)).find((p) => p.id === partnerId);
			expect(row).toMatchObject({ perksPublished: 2, cashiersActive: 1, uses30Days: 1 });
		});
	});

	it('a new partner goes last; ↑ swaps with the neighbour and is audited; the edge changes nothing', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const a = await newPartner(tx, admin);
			const b = await newPartner(tx, admin);
			const ids = async () => (await listPartnersAdmin(tx)).map((p) => p.id);
			expect((await ids()).slice(-2)).toEqual([a, b]);
			expect(await movePartner(tx, admin, b, 'up', '10.0.0.8')).toBe('ok');
			expect((await ids()).slice(-2)).toEqual([b, a]);
			const entries = await auditFor(tx, 'volunteer_partner', b);
			const count = (await ids()).length;
			expect(entries.map((e) => e.action)).toEqual([
				'volunteer_partner.create',
				'volunteer_partner.reorder'
			]);
			expect(entries[1]).toMatchObject({
				actorId: admin.id,
				action: 'volunteer_partner.reorder',
				before: { position: count },
				after: { position: count - 1 },
				ip: '10.0.0.8'
			});
			expect(await movePartner(tx, admin, a, 'down', null)).toBe('ok');
			expect(await auditFor(tx, 'volunteer_partner', a)).toHaveLength(1);
			expect((await ids()).slice(-2)).toEqual([b, a]);
		});
	});

	it('move refusals: not an admin, unknown partner', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const a = await newPartner(tx, admin);
			const moderator = await staff(tx, 'moderator');
			expect(await movePartner(tx, moderator, a, 'up', null)).toBe('not_allowed');
			expect(await movePartner(tx, admin, crypto.randomUUID(), 'up', null)).toBe('not_found');
			expect(await movePartner(tx, admin, 'nope', 'up', null)).toBe('not_found');
		});
	});
});
