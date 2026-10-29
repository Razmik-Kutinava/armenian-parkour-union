import { and, asc, eq, isNull, lte, gte, or, sql } from 'drizzle-orm';
import type { LocalizedText } from '#lib/i18n/localized.ts';
import { yerevanDay } from '#lib/validation/admin-payments.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { volunteerPartners, volunteerPerks } from '../../db/schema/volunteer-partners';
import { isUuid } from '../users/target';

/* docs/03 section 19.3: what the check page, the PDF and the cabinet show — a published partner with
 * its published perks valid today in Yerevan. A single perk counts down per card: marks minus their
 * reversals, against the current limit, never below 0. */

export type VisiblePerk = {
	id: string;
	title: LocalizedText;
	terms: LocalizedText | null;
	kind: 'reusable' | 'single';
	usesLimit: number | null;
	/** `single` only; without a card — the whole limit. */
	remaining: number | null;
};
export type VisiblePartner = {
	id: string;
	name: string;
	logoKey: string | null;
	perks: VisiblePerk[];
};

/** Marks of this card on the perk minus their reversals (a reversal repeats card and perk). */
const usedSql = (cardId: string) => sql<number>`(select
	count(*) filter (where r.reversal_of_id is null) - count(*) filter (where r.reversal_of_id is not null)
	from perk_redemptions r where r.card_id = ${cardId} and r.perk_id = ${volunteerPerks.id})`;

export async function visiblePartners(
	db: LimitDb,
	cardId: string | null,
	now = new Date()
): Promise<VisiblePartner[]> {
	const today = yerevanDay(now);
	const card = cardId && isUuid(cardId) ? cardId : null;
	const rows = await db
		.select({
			partnerId: volunteerPartners.id,
			name: volunteerPartners.name,
			logoKey: volunteerPartners.logoKey,
			id: volunteerPerks.id,
			title: volunteerPerks.title,
			terms: volunteerPerks.terms,
			kind: volunteerPerks.kind,
			usesLimit: volunteerPerks.usesLimit,
			used: card ? usedSql(card).mapWith(Number) : sql<number>`0`.mapWith(Number)
		})
		.from(volunteerPerks)
		.innerJoin(volunteerPartners, eq(volunteerPartners.id, volunteerPerks.partnerId))
		.where(
			and(
				eq(volunteerPartners.status, 'published'),
				eq(volunteerPerks.status, 'published'),
				or(isNull(volunteerPerks.validFrom), lte(volunteerPerks.validFrom, today)),
				or(isNull(volunteerPerks.validUntil), gte(volunteerPerks.validUntil, today))
			)
		)
		.orderBy(
			asc(volunteerPartners.sortOrder),
			asc(volunteerPartners.name),
			asc(volunteerPartners.id),
			asc(volunteerPerks.sortOrder),
			asc(volunteerPerks.createdAt),
			asc(volunteerPerks.id)
		);

	const partners = new Map<string, VisiblePartner>();
	for (const row of rows) {
		const partner = partners.get(row.partnerId) ?? {
			id: row.partnerId,
			name: row.name,
			logoKey: row.logoKey,
			perks: []
		};
		partners.set(row.partnerId, partner);
		partner.perks.push({
			id: row.id,
			title: row.title as LocalizedText,
			terms: (row.terms as LocalizedText | null) ?? null,
			kind: row.kind,
			usesLimit: row.usesLimit,
			remaining:
				row.kind === 'single' && row.usesLimit !== null
					? Math.max(row.usesLimit - row.used, 0)
					: null
		});
	}
	return [...partners.values()];
}
