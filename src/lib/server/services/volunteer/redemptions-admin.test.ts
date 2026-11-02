import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { testDb, testDbUrl } from '../../db/test-db';
import { volunteerPerks } from '../../db/schema/volunteer-partners';
import { applyForCard } from './card-apply';
import { bindCashier, findCashier } from './cashier-access';
import { decideCard } from './card-decision';
import { createCashier } from './cashiers-admin';
import { markPerk } from './perk-mark';
import { reversePerk } from './perk-reverse';
import { createPartner } from './partners-admin';
import {
	listRedemptions,
	redemptionsCsv,
	redemptionsListOptions,
	redemptionsSummary,
	type RedemptionRow
} from './redemptions-admin';
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
import { readListState } from '#lib/components/admin/list-state.ts';

/* docs/05 section 28 "Redemptions": journal, partner summary, CSV; filters stay in the URL. */

async function setup(tx: LimitDb) {
	const admin = await staff(tx);
	const user = await volunteer(tx, { firstName: 'Ani', lastName: 'Mark' });
	const applied = await applyForCard(tx, user.id, deps(mailbox().send));
	if (!applied.ok) throw new Error(applied.reason);
	await decideCard(tx, admin, applied.id, { action: 'issue' }, deps(mailbox().send));
	const card = await cardRow(tx, applied.id);
	const partnerName = `Cafe ${crypto.randomUUID().slice(0, 6)}`;
	const partner = await createPartner(
		tx,
		admin,
		partnerValues({ name: partnerName, status: 'published' }),
		null
	);
	if (typeof partner === 'string') throw new Error(partner);
	const [perk] = await tx
		.insert(volunteerPerks)
		.values({
			...perkValues({ title: { en: 'Free tea', ru: 'Чай' }, status: 'published' }),
			partnerId: partner.id
		})
		.returning({ id: volunteerPerks.id, title: volunteerPerks.title });
	const created = await createCashier(tx, admin, partner.id, 'Bar', null);
	if (typeof created === 'string') throw new Error(created);
	const cashier = await findCashier(tx, await bindCashier(tx, created.token));
	if (!cashier) throw new Error('no cashier');
	const mark = await markPerk(tx, card.publicToken!, cashier, partner.id, perk.id);
	if (!mark.ok) throw new Error(mark.reason);
	return {
		admin,
		cardNumber: card.number!,
		partnerId: partner.id,
		partnerName,
		perkId: perk.id,
		redemptionId: mark.redemptionId,
		cashierLabel: 'Bar'
	};
}

const state = (query: Record<string, string> = {}) =>
	readListState(new URLSearchParams(query), redemptionsListOptions);

describe.skipIf(!testDbUrl)('admin redemptions journal', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('lists a mark with partner, perk, cashier; a reversal links back', async () => {
		await inRollback(async (tx) => {
			const ctx = await setup(tx);
			const { rows, total } = await listRedemptions(tx, state({ q: ctx.cardNumber }));
			expect(total).toBeGreaterThanOrEqual(1);
			const mark = rows.find((r) => r.id === ctx.redemptionId) as RedemptionRow;
			expect(mark).toMatchObject({
				cardNumber: ctx.cardNumber,
				partnerId: ctx.partnerId,
				partnerName: ctx.partnerName,
				perkId: ctx.perkId,
				cashierLabel: ctx.cashierLabel,
				reversalOfId: null,
				reversedById: null,
				comment: null
			});
			await reversePerk(tx, ctx.admin, { redemptionId: ctx.redemptionId, comment: 'Mistake' }, {
				ip: IP
			});
			const after = await listRedemptions(tx, state({ q: ctx.cardNumber }));
			const original = after.rows.find((r) => r.id === ctx.redemptionId)!;
			expect(original.reversedById).toBeTruthy();
			const rev = after.rows.find((r) => r.reversalOfId === ctx.redemptionId)!;
			expect(rev).toMatchObject({
				cashierLabel: null,
				comment: 'Mistake',
				createdByName: expect.any(String)
			});
		});
	});

	it('summary counts non-reversed marks per perk and unique cards; CSV has the rows', async () => {
		await inRollback(async (tx) => {
			const ctx = await setup(tx);
			const summary = await redemptionsSummary(tx, state({ partner: ctx.partnerId }));
			const line = summary.find((s) => s.perkId === ctx.perkId);
			expect(line).toMatchObject({ marks: 1, uniqueCards: 1, partnerId: ctx.partnerId });
			await reversePerk(tx, ctx.admin, { redemptionId: ctx.redemptionId, comment: 'Undo' }, {
				ip: IP
			});
			expect(
				(await redemptionsSummary(tx, state({ partner: ctx.partnerId }))).find(
					(s) => s.perkId === ctx.perkId
				)
			).toBeUndefined();
			const csv = redemptionsCsv(
				(await listRedemptions(tx, state({ partner: ctx.partnerId }))).rows
			);
			expect(csv).toContain(ctx.cardNumber);
			expect(csv).toContain(ctx.partnerName);
		});
	});
});
