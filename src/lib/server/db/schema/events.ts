import { sql } from 'drizzle-orm';
import {
	char,
	check,
	index,
	integer,
	jsonb,
	numeric,
	pgTable,
	smallint,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core';
import { discipline, eventStatus } from './enums';
import { users } from './users';

/* docs/02-DATABASE.md section 3; NOT NULL and category timestamps — decisions.md 2026-10-08 (2.5). */

const timestamps = {
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date())
};

/** Visible to guests when published (or finished, cancelled) and `published_at <= now()`. */
export const events = pgTable(
	'events',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		slug: text('slug').notNull().unique(),
		title: jsonb('title').notNull(),
		description: jsonb('description').notNull().default({}),
		coverKey: text('cover_key'),
		status: eventStatus('status').notNull().default('draft'),
		startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
		endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
		locationName: text('location_name'),
		address: text('address'),
		city: text('city'),
		latitude: numeric('latitude', { precision: 9, scale: 6, mode: 'number' }),
		longitude: numeric('longitude', { precision: 9, scale: 6, mode: 'number' }),
		/** `null` — no limit. */
		capacity: integer('capacity'),
		/** `0` — free. */
		priceAmountMinor: integer('price_amount_minor').notNull().default(0),
		priceCurrency: char('price_currency', { length: 3 }).notNull().default('AMD'),
		registrationOpensAt: timestamp('registration_opens_at', { withTimezone: true }),
		registrationClosesAt: timestamp('registration_closes_at', { withTimezone: true }),
		publishedAt: timestamp('published_at', { withTimezone: true }),
		createdBy: uuid('created_by').references(() => users.id),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		...timestamps
	},
	(t) => [
		index('events_status_starts_at_idx').on(t.status, t.startsAt),
		check('events_ends_after_starts', sql`${t.endsAt} >= ${t.startsAt}`)
	]
);

/** Categories and age groups inside an event. */
export const eventCategories = pgTable(
	'event_categories',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		eventId: uuid('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }),
		name: jsonb('name').notNull(),
		discipline: discipline('discipline').notNull().default('other'),
		ageMin: smallint('age_min'),
		ageMax: smallint('age_max'),
		capacity: integer('capacity'),
		sortOrder: integer('sort_order').notNull().default(0),
		...timestamps
	},
	(t) => [index('event_categories_event_id_idx').on(t.eventId)]
);
