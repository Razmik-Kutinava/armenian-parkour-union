import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { perkRedemptions, volunteerCards } from '../../db/schema/volunteer-cards';
import {
	partnerCashiers,
	volunteerPartners,
	volunteerPerks
} from '../../db/schema/volunteer-partners';
import { visiblePartners } from './perks-visible';
import { partnerValues, perkValues, staff } from './test-support';

/* docs/03 section 19.3: only a published partner with its published perks valid today (Yerevan);
 * a single perk counts down per card — marks minus their reversals, never below 0. */

const NOW = new Date('2026-10-29T21:30:00Z'); // 30 October 01:30 in Yerevan

async function partner(tx: LimitDb, status: 'draft' | 'published' | 'archived', sortOrder = 0) {
	const [row] = await tx
		.insert(volunteerPartners)
		.values({ ...partnerValues({ status }), sortOrder })
		.returning({ id: volunteerPartners.id });
	return row.id;
}

type Perk = Parameters<typeof perkValues>[0];
async function perk(tx: LimitDb, partnerId: string, extra: Perk) {
	const [row] = await tx
		.insert(volunteerPerks)
		.values({ ...perkValues({ status: 'published', ...extra }), partnerId })
		.returning({ id: volunteerPerks.id });
	return row.id;
}

async function card(tx: LimitDb) {
	const { id: userId } = await insertUser(tx);
	const [row] = await tx
		.insert(volunteerCards)
		.values({ userId, appliedAt: NOW })
		.returning({ id: volunteerCards.id });
	return row.id;
}

describe.skipIf(!testDbUrl)('visible partners and perks', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('published partner and perk, today inside the dates by Yerevan; in sort order', async () => {
		await inRollback(async (tx) => {
			const second = await partner(tx, 'published', 1_000_001);
			const first = await partner(tx, 'published', 1_000_000);
			const hiddenPartner = await partner(tx, 'draft');
			const archived = await partner(tx, 'archived');
			await perk(tx, hiddenPartner, {});
			await perk(tx, archived, {});
			const late = await perk(tx, first, { sortOrder: 2, validUntil: '2026-10-30' });
			const early = await perk(tx, first, { sortOrder: 1, validFrom: '2026-10-30' });
			await perk(tx, first, { status: 'draft' });
			await perk(tx, first, { validUntil: '2026-10-29' });
			await perk(tx, first, { validFrom: '2026-10-31' });
			const only = await perk(tx, second, {});

			const ours = (await visiblePartners(tx, null, NOW)).filter((p) =>
				[first, second, hiddenPartner, archived].includes(p.id)
			);
			expect(ours.map((p) => p.id)).toEqual([first, second]);
			expect(ours[0].perks.map((p) => p.id)).toEqual([early, late]);
			expect(ours[1].perks.map((p) => p.id)).toEqual([only]);
			expect(ours[0].perks[0]).toMatchObject({
				title: { en: '10% off', ru: 'Скидка 10 %' },
				terms: null,
				kind: 'reusable',
				remaining: null
			});
		});
	});

	it('a partner without visible perks is not shown', async () => {
		await inRollback(async (tx) => {
			const id = await partner(tx, 'published');
			await perk(tx, id, { status: 'archived' });
			expect((await visiblePartners(tx, null, NOW)).some((p) => p.id === id)).toBe(false);
		});
	});

	it('single: the limit minus marks of this card plus their reversals, not below 0', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const partnerId = await partner(tx, 'published');
			const twice = await perk(tx, partnerId, { kind: 'single', usesLimit: 2, sortOrder: 1 });
			const once = await perk(tx, partnerId, { kind: 'single', usesLimit: 1, sortOrder: 2 });
			const [till] = await tx
				.insert(partnerCashiers)
				.values({ partnerId, label: 'Till', createdBy: admin.id })
				.returning({ id: partnerCashiers.id });
			const mine = await card(tx);
			const other = await card(tx);
			const mark = (cardId: string, perkId: string) => ({
				cardId,
				perkId,
				partnerId,
				cashierId: till.id
			});
			const marks = await tx
				.insert(perkRedemptions)
				.values([
					mark(mine, twice),
					mark(mine, twice),
					mark(other, twice),
					mark(mine, once),
					mark(mine, once)
				])
				.returning({ id: perkRedemptions.id });
			await tx.insert(perkRedemptions).values({
				cardId: mine,
				perkId: twice,
				partnerId,
				reversalOfId: marks[1].id,
				comment: 'Mistake',
				createdBy: admin.id
			});

			const remaining = async (cardId: string | null) =>
				(await visiblePartners(tx, cardId, NOW))
					.find((p) => p.id === partnerId)
					?.perks.map((p) => p.remaining);
			expect(await remaining(mine)).toEqual([1, 0]);
			expect(await remaining(other)).toEqual([1, 1]);
			expect(await remaining(null)).toEqual([2, 1]);
		});
	});
});
