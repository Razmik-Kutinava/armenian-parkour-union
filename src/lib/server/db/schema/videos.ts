import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { videoStatus } from './enums';
import { events } from './events';
import { users } from './users';

/* docs/02-DATABASE.md section 6; `hidden_at`, `updated_at` — decisions.md 2026-10-24 (7.1). */

export const videoPlatforms = ['youtube', 'instagram', 'tiktok', 'other'] as const;

/** Links only (docs/03 section 8); `url` is stored normalized, so one video is one link. */
export const videos = pgTable(
	'videos',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id),
		url: text('url').notNull(),
		platform: text('platform', { enum: videoPlatforms }).notNull(),
		title: text('title'),
		eventId: uuid('event_id').references(() => events.id),
		status: videoStatus('status').notNull().default('pending'),
		reviewedBy: uuid('reviewed_by').references(() => users.id),
		reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
		rejectReason: text('reject_reason'),
		/** Hidden from the site; status and points stay (docs/03 section 8 p. 5). */
		hiddenAt: timestamp('hidden_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date())
	},
	(t) => [
		uniqueIndex('videos_user_id_url_key').on(t.userId, t.url),
		index('videos_user_id_idx').on(t.userId),
		index('videos_status_created_at_idx').on(t.status, t.createdAt),
		check('videos_platform', sql`${t.platform} IN ('youtube', 'instagram', 'tiktok', 'other')`),
		check(
			'videos_reject_reason',
			sql`(${t.status} = 'rejected') = (btrim(coalesce(${t.rejectReason}, '')) <> '')
				AND (${t.status} = 'rejected' OR ${t.rejectReason} IS NULL)`
		),
		check('videos_reviewed_at', sql`(${t.status} = 'pending') = (${t.reviewedAt} IS NULL)`),
		check('videos_hidden_approved', sql`${t.hiddenAt} IS NULL OR ${t.status} = 'approved'`)
	]
);
