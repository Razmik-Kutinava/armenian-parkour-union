import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { testDb, testDbUrl } from '../../db/test-db';
import { auditLog } from '../../db/schema/service';
import { perkRedemptions } from '../../db/schema/volunteer-cards';
import { volunteerPerks } from '../../db/schema/volunteer-partners';
import { applyForCard } from './card-apply';
import { bindCashier, findCashier } from './cashier-access';
import { decideCard } from './card-decision';
import { createCashier } from './cashiers-admin';
import { markPerk } from './perk-mark';
import { reversePerk } from './perk-reverse';
import { createPartner } from './partners-admin';
import { visiblePartners } from './perks-visible';
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

/* docs/03 section 19.4 p. 5, 19.9 p. 1: admin reverses a cashier mark once; remaining uses return. */

async function marked(tx: LimitDb, kind: 'reusable' | 'single' = 'single') {
	const admin = await staff(tx);
	const user = await volunteer(tx);
	const applied = await applyForCard(tx, user.id, deps(mailbox().send));
	if (!applied.ok) throw new Error(applied.reason);
	await decideCard(tx, admin, applied.id, { action: 'issue' }, deps(mailbox().send));
	const row = await cardRow(tx, applied.id);
	const partner = await createPartner(tx, admin, partnerValues({ status: 'published' }), null);
	if (typeof partner === 'string') throw new Error(partner);
	const [perk] = await tx
		.insert(volunteerPerks)
		.values({
			...perkValues({
				status: 'published',
				kind,
				usesLimit: kind === 'single' ? 1 : null
			}),
			partnerId: partner.id
		})
		.returning({ id: volunteerPerks.id });
	const created = await createCashier(tx, admin, partner.id, 'Till', null);
	if (typeof created === 'string') throw new Error(created);
	const device = await bindCashier(tx, created.token);
	const cashier = await findCashier(tx, device);
	if (!cashier) throw new Error('no cashier');
	const mark = await markPerk(tx, row.publicToken!, cashier, partner.id, perk.id);
	if (!mark.ok) throw new Error(mark.reason);
	return {
		admin,
		userId: user.id,
		cardId: applied.id,
		perkId: perk.id,
		partnerId: partner.id,
		redemptionId: mark.redemptionId
	};
}

describe.skipIf(!testDbUrl)('admin reverses a perk mark', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('inserts a reversal, restores a single perk remaining, writes audit once', async () => {
		await inRollback(async (tx) => {
			const { admin, cardId, perkId, redemptionId } = await marked(tx);
			const before = await visiblePartners(tx, cardId);
			expect(before.find((p) => p.perks.some((x) => x.id === perkId))?.perks[0].remaining).toBe(
				0
			);

			const result = await reversePerk(
				tx,
				admin,
				{ redemptionId, comment: ' Wrong till ' },
				{ ip: IP }
			);
			expect(result).toEqual({ ok: true, reversalId: expect.any(String) });
			if (!result.ok) return;

			const [rev] = await tx
				.select()
				.from(perkRedemptions)
				.where(eq(perkRedemptions.id, result.reversalId));
			expect(rev).toMatchObject({
				cardId,
				perkId,
				cashierId: null,
				reversalOfId: redemptionId,
				comment: 'Wrong till',
				createdBy: admin.id
			});
			const after = await visiblePartners(tx, cardId);
			expect(after.find((p) => p.perks.some((x) => x.id === perkId))?.perks[0].remaining).toBe(1);

			const audits = await tx
				.select()
				.from(auditLog)
				.where(eq(auditLog.action, 'perk_redemption.reverse'));
			expect(audits).toHaveLength(1);
			expect(audits[0]).toMatchObject({
				actorId: admin.id,
				entityType: 'volunteer_card',
				entityId: cardId
			});
		});
	});

	it('one mark — one reversal; empty comment and non-admin refused', async () => {
		await inRollback(async (tx) => {
			const { admin, redemptionId } = await marked(tx, 'reusable');
			expect(await reversePerk(tx, admin, { redemptionId, comment: 'Once' }, { ip: IP })).toEqual({
				ok: true,
				reversalId: expect.any(String)
			});
			expect(await reversePerk(tx, admin, { redemptionId, comment: 'Twice' }, { ip: IP })).toEqual(
				{ ok: false, reason: 'already_reversed' }
			);
			const moderator = await staff(tx, 'moderator');
			const other = await marked(tx);
			expect(
				await reversePerk(tx, moderator, { redemptionId: other.redemptionId, comment: 'x' }, {
					ip: IP
				})
			).toEqual({ ok: false, reason: 'not_allowed' });
			expect(await reversePerk(tx, admin, { redemptionId: other.redemptionId, comment: '  ' }, {
				ip: IP
			})).toEqual({ ok: false, reason: 'invalid' });
			const [rev] = await tx
				.select({ id: perkRedemptions.id })
				.from(perkRedemptions)
				.where(and(eq(perkRedemptions.reversalOfId, redemptionId), isNull(perkRedemptions.cashierId)));
			expect(
				await reversePerk(tx, admin, { redemptionId: rev.id, comment: 'Undo reverse' }, { ip: IP })
			).toEqual({ ok: false, reason: 'not_reversible' });
		});
	});
});
