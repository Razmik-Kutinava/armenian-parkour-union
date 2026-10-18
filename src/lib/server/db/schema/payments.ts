import { sql } from 'drizzle-orm';
import {
	boolean,
	char,
	check,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	type AnyPgColumn
} from 'drizzle-orm/pg-core';
import { membershipStatus, paymentKind, paymentStatus } from './enums';
import { users } from './users';

/* docs/02-DATABASE.md sections 2, 4; timestamps and the webhook trigger — decisions.md 2026-10-18 (3.1). */

const createdAt = timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = timestamp('updated_at', { withTimezone: true })
	.notNull()
	.defaultNow()
	.$onUpdate(() => new Date());

/** Hidden with `is_active`, never deleted: payments point to it. */
export const donationPurposes = pgTable('donation_purposes', {
	id: uuid('id').primaryKey().defaultRandom(),
	title: jsonb('title').notNull(),
	isActive: boolean('is_active').notNull().default(true),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt,
	updatedAt
});

/** One row per paid period; renewal adds a row. Dates are set once the fee is paid. */
export const memberships = pgTable(
	'memberships',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id),
		status: membershipStatus('status').notNull().default('pending'),
		startsAt: timestamp('starts_at', { withTimezone: true }),
		endsAt: timestamp('ends_at', { withTimezone: true }),
		paymentId: uuid('payment_id').references((): AnyPgColumn => payments.id),
		createdAt,
		updatedAt
	},
	(t) => [
		index('memberships_user_id_idx').on(t.userId),
		index('memberships_status_ends_at_idx').on(t.status, t.endsAt),
		check(
			'memberships_ends_after_starts',
			sql`${t.startsAt} IS NULL OR ${t.endsAt} IS NULL OR ${t.endsAt} >= ${t.startsAt}`
		)
	]
);

/** Status changes only through the payment service or a logged manual confirmation (docs/07). */
export const payments = pgTable(
	'payments',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		/** `null` — anonymous donation. */
		userId: uuid('user_id').references(() => users.id),
		kind: paymentKind('kind').notNull(),
		status: paymentStatus('status').notNull().default('pending'),
		amountMinor: integer('amount_minor').notNull(),
		currency: char('currency', { length: 3 }).notNull(),
		provider: text('provider').notNull(),
		providerPaymentId: text('provider_payment_id'),
		providerPayload: jsonb('provider_payload'),
		donationPurposeId: uuid('donation_purpose_id').references(() => donationPurposes.id),
		donorName: text('donor_name'),
		donorEmail: text('donor_email'),
		isAnonymous: boolean('is_anonymous').notNull().default(false),
		receiptUrl: text('receipt_url'),
		paidAt: timestamp('paid_at', { withTimezone: true }),
		refundedAt: timestamp('refunded_at', { withTimezone: true }),
		confirmedBy: uuid('confirmed_by').references(() => users.id),
		expiresAt: timestamp('expires_at', { withTimezone: true }),
		failureReason: text('failure_reason'),
		needsReview: boolean('needs_review').notNull().default(false),
		membershipId: uuid('membership_id').references((): AnyPgColumn => memberships.id),
		createdAt,
		updatedAt
	},
	(t) => [
		uniqueIndex('payments_provider_payment_id_key')
			.on(t.provider, t.providerPaymentId)
			.where(sql`${t.providerPaymentId} IS NOT NULL`),
		index('payments_user_id_idx').on(t.userId),
		index('payments_kind_status_idx').on(t.kind, t.status),
		index('payments_paid_at_idx').on(t.paidAt),
		index('payments_status_expires_at_idx').on(t.status, t.expiresAt),
		check('payments_amount_positive', sql`${t.amountMinor} > 0`)
	]
);

/** Webhook dedup. Never deleted; only `processed_at` and `error` change (trigger in 0007). */
export const paymentWebhookEvents = pgTable(
	'payment_webhook_events',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		provider: text('provider').notNull(),
		eventId: text('event_id').notNull(),
		payload: jsonb('payload').notNull(),
		processedAt: timestamp('processed_at', { withTimezone: true }),
		error: text('error'),
		createdAt
	},
	(t) => [uniqueIndex('payment_webhook_events_provider_event_key').on(t.provider, t.eventId)]
);
