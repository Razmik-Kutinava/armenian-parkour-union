import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core';
import { heroType } from './enums';
import { events } from './events';
import { users } from './users';

/* docs/02-DATABASE.md `hero_blocks`; `archived_at` — decisions.md 2026-10-08 (2.6). */

/** Shown on the home page when active, not archived and `now()` is inside `starts_at…ends_at`. */
export const heroBlocks = pgTable(
	'hero_blocks',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		type: heroType('type').notNull(),
		title: jsonb('title').notNull().default({}),
		subtitle: jsonb('subtitle').notNull().default({}),
		mediaKey: text('media_key'),
		videoUrl: text('video_url'),
		ctaLabel: jsonb('cta_label'),
		ctaUrl: text('cta_url'),
		eventId: uuid('event_id').references(() => events.id),
		personUserId: uuid('person_user_id').references(() => users.id),
		sortOrder: integer('sort_order').notNull().default(0),
		isActive: boolean('is_active').notNull().default(false),
		startsAt: timestamp('starts_at', { withTimezone: true }),
		endsAt: timestamp('ends_at', { withTimezone: true }),
		archivedAt: timestamp('archived_at', { withTimezone: true }),
		createdBy: uuid('created_by').references(() => users.id),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date())
	},
	(t) => [
		index('hero_blocks_active_sort_idx').on(t.isActive, t.sortOrder),
		check('hero_blocks_event_has_event', sql`${t.type} <> 'event' OR ${t.eventId} IS NOT NULL`),
		check(
			'hero_blocks_person_has_user',
			sql`${t.type} <> 'person' OR ${t.personUserId} IS NOT NULL`
		),
		check('hero_blocks_video_has_url', sql`${t.type} <> 'video' OR ${t.videoUrl} IS NOT NULL`),
		check(
			'hero_blocks_ends_after_starts',
			sql`${t.startsAt} IS NULL OR ${t.endsAt} IS NULL OR ${t.endsAt} >= ${t.startsAt}`
		)
	]
);
