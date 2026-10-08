import { boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
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
