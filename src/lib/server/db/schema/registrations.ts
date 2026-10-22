import {
	index,
	numeric,
	pgTable,
	smallint,
	text,
	timestamp,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';
import { registrationStatus } from './enums';
import { eventCategories, events } from './events';
import { payments } from './payments';
import { users } from './users';

/* docs/02-DATABASE.md section 3; `pending_payment` and `hold_until` — decisions.md 2026-10-22 (5.1). */

/** Results live here too. Re-registering after a cancel reuses the row: one per user and event. */
export const eventRegistrations = pgTable(
	'event_registrations',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		eventId: uuid('event_id')
			.notNull()
			.references(() => events.id),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id),
		categoryId: uuid('category_id').references(() => eventCategories.id),
		status: registrationStatus('status').notNull().default('registered'),
		paymentId: uuid('payment_id').references(() => payments.id),
		/** `pending_payment` holds the seat until then: after registering or after the waitlist. */
		holdUntil: timestamp('hold_until', { withTimezone: true }),
		registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
		attendedAt: timestamp('attended_at', { withTimezone: true }),
		/** Final place, `1` — the winner. */
		place: smallint('place'),
		score: numeric('score', { precision: 6, scale: 2 }),
		resultNote: text('result_note'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date())
	},
	(t) => [
		uniqueIndex('event_registrations_event_id_user_id_key').on(t.eventId, t.userId),
		index('event_registrations_user_id_idx').on(t.userId),
		index('event_registrations_event_id_status_idx').on(t.eventId, t.status)
	]
);
