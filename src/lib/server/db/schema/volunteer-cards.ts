import { sql } from 'drizzle-orm';
import {
	type AnyPgColumn,
	check,
	index,
	pgTable,
	smallint,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core';
import { volunteerCardStatus } from './enums';
import { users } from './users';
import { partnerCashiers, volunteerPartners, volunteerPerks } from './volunteer-partners';

/* docs/02-DATABASE.md section 12 (cards, perk redemptions). */

/** One row per member; applying again after a refusal or a revocation returns it to `pending`.
 * No expiry: valid while the owner's membership is active (docs/03 section 19.2). */
export const volunteerCards = pgTable(
	'volunteer_cards',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.unique()
			.references(() => users.id),
		status: volunteerCardStatus('status').notNull().default('pending'),
		/** `APU-V-{year}-{0001}`, set on the first issue and never changed. */
		number: text('number').unique(),
		/** Check page and QR; new on every issue, so an old QR stops working. */
		publicToken: text('public_token').unique(),
		appliedAt: timestamp('applied_at', { withTimezone: true }).notNull(),
		issuedAt: timestamp('issued_at', { withTimezone: true }),
		reviewedBy: uuid('reviewed_by').references(() => users.id),
		reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
		/** Shown to the member; required for `rejected` and `revoked`. */
		reviewNote: text('review_note'),
		/** Declines in a row (docs/03 section 19.6). */
		declineStreak: smallint('decline_streak').notNull().default(0),
		flaggedAt: timestamp('flagged_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date())
	},
	(t) => [
		index('volunteer_cards_status_applied_at_idx').on(t.status, t.appliedAt),
		index('volunteer_cards_flagged_at_idx')
			.on(t.flaggedAt)
			.where(sql`${t.flaggedAt} IS NOT NULL`),
		check('volunteer_cards_decline_streak', sql`${t.declineStreak} >= 0`),
		check(
			'volunteer_cards_review_note',
			sql`${t.status} NOT IN ('rejected', 'revoked') OR btrim(coalesce(${t.reviewNote}, '')) <> ''`
		)
	]
);

/** Append-only: UPDATE, DELETE and TRUNCATE are rejected by a trigger (migration 0018).
 * A mistake is fixed by a reversal row; the remaining uses of a single perk are
 * `uses_limit` − (marks − their reversals), not below 0. */
export const perkRedemptions = pgTable(
	'perk_redemptions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		cardId: uuid('card_id')
			.notNull()
			.references(() => volunteerCards.id),
		perkId: uuid('perk_id')
			.notNull()
			.references(() => volunteerPerks.id),
		partnerId: uuid('partner_id')
			.notNull()
			.references(() => volunteerPartners.id),
		/** Who marked it; `null` on a reversal. */
		cashierId: uuid('cashier_id').references(() => partnerCashiers.id),
		reversalOfId: uuid('reversal_of_id')
			.unique()
			.references((): AnyPgColumn => perkRedemptions.id),
		comment: text('comment'),
		/** The admin who reversed; `null` on a cashier's mark. */
		createdBy: uuid('created_by').references(() => users.id),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('perk_redemptions_card_id_perk_id_idx').on(t.cardId, t.perkId),
		index('perk_redemptions_partner_id_created_at_idx').on(t.partnerId, t.createdAt.desc()),
		index('perk_redemptions_cashier_id_created_at_idx').on(t.cashierId, t.createdAt.desc()),
		check(
			'perk_redemptions_kind',
			sql`CASE WHEN ${t.reversalOfId} IS NULL
				THEN ${t.cashierId} IS NOT NULL AND ${t.comment} IS NULL AND ${t.createdBy} IS NULL
				ELSE ${t.cashierId} IS NULL AND btrim(coalesce(${t.comment}, '')) <> ''
					AND ${t.createdBy} IS NOT NULL
				END`
		)
	]
);
