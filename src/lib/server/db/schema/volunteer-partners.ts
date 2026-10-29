import { sql } from 'drizzle-orm';
import {
	check,
	date,
	index,
	integer,
	jsonb,
	pgTable,
	smallint,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core';
import { contentStatus, perkKind } from './enums';
import { users } from './users';

/* docs/02-DATABASE.md section 12 (partners, perks, cashier access). */

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
	timestamp('updated_at', { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date());

/** No deletion: `archived`. Only `published` reaches the check page, the PDF and the cabinet. */
export const volunteerPartners = pgTable(
	'volunteer_partners',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		/** A brand, not translated. */
		name: text('name').notNull(),
		logoKey: text('logo_key'),
		website: text('website'),
		address: jsonb('address'),
		status: contentStatus('status').notNull().default('draft'),
		sortOrder: integer('sort_order').notNull().default(0),
		createdBy: uuid('created_by').references(() => users.id),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index('volunteer_partners_status_sort_order_idx').on(t.status, t.sortOrder)]
);

/** No deletion (redemptions point here): `archived`. Dates are Yerevan days. */
export const volunteerPerks = pgTable(
	'volunteer_perks',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		partnerId: uuid('partner_id')
			.notNull()
			.references(() => volunteerPartners.id),
		title: jsonb('title').notNull(),
		terms: jsonb('terms'),
		kind: perkKind('kind').notNull(),
		/** Uses per card, `single` only. */
		usesLimit: smallint('uses_limit'),
		validFrom: date('valid_from'),
		validUntil: date('valid_until'),
		status: contentStatus('status').notNull().default('draft'),
		sortOrder: integer('sort_order').notNull().default(0),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('volunteer_perks_partner_id_status_idx').on(t.partnerId, t.status),
		check(
			'volunteer_perks_uses_limit',
			sql`(${t.kind} = 'single') = (${t.usesLimit} IS NOT NULL) AND coalesce(${t.usesLimit}, 1) >= 1`
		),
		check(
			'volunteer_perks_valid_range',
			sql`${t.validFrom} IS NULL OR ${t.validUntil} IS NULL OR ${t.validFrom} <= ${t.validUntil}`
		)
	]
);

/** One phone bound by an invite link; only SHA-256 hashes of the tokens are stored.
 * A new link for the same row clears the device: the old phone stops working. */
export const partnerCashiers = pgTable(
	'partner_cashiers',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		partnerId: uuid('partner_id')
			.notNull()
			.references(() => volunteerPartners.id),
		label: text('label').notNull(),
		/** `null` once the phone is bound. */
		inviteTokenHash: text('invite_token_hash').unique(),
		inviteExpiresAt: timestamp('invite_expires_at', { withTimezone: true }),
		deviceTokenHash: text('device_token_hash').unique(),
		boundAt: timestamp('bound_at', { withTimezone: true }),
		lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
		/** Neither the link nor the phone works. */
		disabledAt: timestamp('disabled_at', { withTimezone: true }),
		disabledBy: uuid('disabled_by').references(() => users.id),
		createdBy: uuid('created_by')
			.notNull()
			.references(() => users.id),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index('partner_cashiers_partner_id_idx').on(t.partnerId)]
);
