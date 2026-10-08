import { sql } from 'drizzle-orm';
import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { contentStatus } from './enums';
import { users } from './users';

/* docs/02-DATABASE.md, section 8; is_system, created_at, deleted_at — decisions.md 2026-10-08. */

export const pages = pgTable('pages', {
	id: uuid('id').primaryKey().defaultRandom(),
	slug: text('slug').notNull().unique(),
	title: jsonb('title').notNull(),
	body: jsonb('body').notNull().default({}),
	status: contentStatus('status').notNull().default('draft'),
	/** Created by the seed script: never deleted, the address never changes. */
	isSystem: boolean('is_system').notNull().default(false),
	updatedBy: uuid('updated_by').references(() => users.id),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
	deletedAt: timestamp('deleted_at', { withTimezone: true })
});

/** News (docs/02 section 8). Visible to guests when published and `published_at <= now()`. */
export const posts = pgTable(
	'posts',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		slug: text('slug').notNull().unique(),
		title: jsonb('title').notNull(),
		excerpt: jsonb('excerpt').notNull().default({}),
		body: jsonb('body').notNull().default({}),
		coverKey: text('cover_key'),
		tags: text('tags')
			.array()
			.notNull()
			.default(sql`'{}'::text[]`),
		status: contentStatus('status').notNull().default('draft'),
		publishedAt: timestamp('published_at', { withTimezone: true }),
		authorId: uuid('author_id').references(() => users.id),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
		deletedAt: timestamp('deleted_at', { withTimezone: true })
	},
	(t) => [index('posts_status_published_at_idx').on(t.status, t.publishedAt.desc())]
);
