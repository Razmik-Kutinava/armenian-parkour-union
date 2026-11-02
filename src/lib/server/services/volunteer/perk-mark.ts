import { and, desc, eq, gt, isNull, lte, gte, or, sql } from 'drizzle-orm';
import { yerevanDay } from '#lib/validation/admin-payments.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { users } from '../../db/schema/users';
import { perkRedemptions, volunteerCards } from '../../db/schema/volunteer-cards';
import {
	partnerCashiers,
	volunteerPartners,
	volunteerPerks
} from '../../db/schema/volunteer-partners';
import { isUuid } from '../users/target';
import type { Cashier } from './cashier-access';
import { lockCardMember } from './card-facts';
import { cardValidity } from './card-rules';
import { paidUntilSql, privacySql } from './card-sql';

/* docs/03 section 19.4 pp. 3–5: a cashier marks a visible perk on a valid card; single perks
 * decrement; double-click within a minute does not insert twice. Reversal is 10.7. */

const TOKEN = /^[A-Za-z0-9_-]{1,64}$/;
const IDEM_MS = 60_000;

export type MarkError =
	| 'bad_request'
	| 'not_found'
	| 'invalid_card'
	| 'wrong_partner'
	| 'perk_unavailable'
	| 'no_uses_left'
	| 'cashier_gone';

export type MarkOk = { ok: true; markedAt: Date; redemptionId: string; duplicate?: true };

const usedSql = (cardId: string) => sql<number>`(select
	count(*) filter (where r.reversal_of_id is null) - count(*) filter (where r.reversal_of_id is not null)
	from perk_redemptions r where r.card_id = ${cardId} and r.perk_id = ${volunteerPerks.id})`;

export async function markPerk(
	db: LimitDb,
	cardToken: string,
	cashier: Cashier,
	partnerId: string,
	perkId: string,
	now = new Date()
): Promise<MarkOk | { ok: false; reason: MarkError }> {
	if (!TOKEN.test(cardToken) || !isUuid(partnerId) || !isUuid(perkId))
		return { ok: false, reason: 'bad_request' };
	if (partnerId !== cashier.partnerId) return { ok: false, reason: 'wrong_partner' };

	return db.transaction(async (tx) => {
		const [card] = await tx
			.select({
				id: volunteerCards.id,
				status: volunteerCards.status,
				userId: volunteerCards.userId,
				number: volunteerCards.number,
				paidUntil: paidUntilSql(now),
				privacy: privacySql(now),
				birthDate: users.birthDate,
				userStatus: users.status,
				deletedAt: users.deletedAt
			})
			.from(volunteerCards)
			.innerJoin(users, eq(users.id, volunteerCards.userId))
			.where(eq(volunteerCards.publicToken, cardToken))
			.for('update');
		if (!card?.number) return { ok: false, reason: 'not_found' };
		if (card.deletedAt) return { ok: false, reason: 'invalid_card' };
		const member = await lockCardMember(tx, card.userId);
		if (!member) return { ok: false, reason: 'invalid_card' };
		const validity = cardValidity(
			card.status,
			{
				birthDate: card.birthDate,
				status: card.userStatus,
				paidUntil: card.paidUntil,
				privacy: card.privacy
			},
			now
		);
		if (!validity.valid) return { ok: false, reason: 'invalid_card' };

		const [cashierRow] = await tx
			.select({ disabledAt: partnerCashiers.disabledAt, boundAt: partnerCashiers.boundAt })
			.from(partnerCashiers)
			.where(eq(partnerCashiers.id, cashier.id))
			.for('update');
		if (!cashierRow?.boundAt || cashierRow.disabledAt) return { ok: false, reason: 'cashier_gone' };

		const today = yerevanDay(now);
		const [perk] = await tx
			.select({
				id: volunteerPerks.id,
				kind: volunteerPerks.kind,
				usesLimit: volunteerPerks.usesLimit,
				used: usedSql(card.id).mapWith(Number)
			})
			.from(volunteerPerks)
			.innerJoin(volunteerPartners, eq(volunteerPartners.id, volunteerPerks.partnerId))
			.where(
				and(
					eq(volunteerPerks.id, perkId),
					eq(volunteerPerks.partnerId, partnerId),
					eq(volunteerPartners.status, 'published'),
					eq(volunteerPerks.status, 'published'),
					or(isNull(volunteerPerks.validFrom), lte(volunteerPerks.validFrom, today)),
					or(isNull(volunteerPerks.validUntil), gte(volunteerPerks.validUntil, today))
				)
			);
		if (!perk) return { ok: false, reason: 'perk_unavailable' };

		if (perk.kind === 'single' && perk.usesLimit !== null) {
			const remaining = Math.max(perk.usesLimit - perk.used, 0);
			if (remaining <= 0) return { ok: false, reason: 'no_uses_left' };
		}

		const since = new Date(now.getTime() - IDEM_MS);
		const [recent] = await tx
			.select({ id: perkRedemptions.id, createdAt: perkRedemptions.createdAt })
			.from(perkRedemptions)
			.where(
				and(
					eq(perkRedemptions.cardId, card.id),
					eq(perkRedemptions.perkId, perkId),
					eq(perkRedemptions.cashierId, cashier.id),
					isNull(perkRedemptions.reversalOfId),
					gt(perkRedemptions.createdAt, since)
				)
			)
			.orderBy(desc(perkRedemptions.createdAt))
			.limit(1);
		if (recent)
			return {
				ok: true,
				markedAt: recent.createdAt,
				redemptionId: recent.id,
				duplicate: true
			};

		const [row] = await tx
			.insert(perkRedemptions)
			.values({
				cardId: card.id,
				perkId,
				partnerId,
				cashierId: cashier.id
			})
			.returning({ id: perkRedemptions.id, createdAt: perkRedemptions.createdAt });
		await tx
			.update(partnerCashiers)
			.set({ lastUsedAt: now })
			.where(eq(partnerCashiers.id, cashier.id));
		return { ok: true, markedAt: row.createdAt, redemptionId: row.id };
	});
}

/** Latest active mark by this cashier on this card and perk (not reversed). */
export async function lastCashierMark(
	db: LimitDb,
	cardId: string,
	perkId: string,
	cashierId: string
): Promise<Date | null> {
	if (!isUuid(cardId) || !isUuid(perkId) || !isUuid(cashierId)) return null;
	const [row] = await db
		.select({ createdAt: perkRedemptions.createdAt })
		.from(perkRedemptions)
		.where(
			and(
				eq(perkRedemptions.cardId, cardId),
				eq(perkRedemptions.perkId, perkId),
				eq(perkRedemptions.cashierId, cashierId),
				isNull(perkRedemptions.reversalOfId),
				sql`not exists (select 1 from perk_redemptions x where x.reversal_of_id = ${perkRedemptions.id})`
			)
		)
		.orderBy(desc(perkRedemptions.createdAt))
		.limit(1);
	return row?.createdAt ?? null;
}
