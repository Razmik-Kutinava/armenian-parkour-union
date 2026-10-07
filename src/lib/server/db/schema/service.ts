import { sql } from 'drizzle-orm';
import {
	check,
	index,
	inet,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core';
import { users } from './users';

/* docs/02-DATABASE.md, section 10. */

export const siteSettings = pgTable('site_settings', {
	key: text('key').primaryKey(),
	value: jsonb('value').notNull(),
	updatedBy: uuid('updated_by').references(() => users.id),
	updatedAt: timestamp('updated_at', { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date())
});

export const media = pgTable(
	'media',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		key: text('key').notNull().unique(),
		originalName: text('original_name').notNull(),
		mime: text('mime').notNull(),
		sizeBytes: integer('size_bytes').notNull(),
		alt: jsonb('alt'),
		uploadedBy: uuid('uploaded_by')
			.notNull()
			.references(() => users.id),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		deletedAt: timestamp('deleted_at', { withTimezone: true })
	},
	(t) => [check('media_size_positive', sql`${t.sizeBytes} > 0`)]
);

/** Append-only: UPDATE, DELETE and TRUNCATE are rejected by a trigger (migration 0001). */
export const auditLog = pgTable(
	'audit_log',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		actorId: uuid('actor_id').references(() => users.id),
		action: text('action').notNull(),
		entityType: text('entity_type'),
		entityId: uuid('entity_id'),
		before: jsonb('before'),
		after: jsonb('after'),
		ip: inet('ip'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('audit_log_entity_idx').on(t.entityType, t.entityId),
		index('audit_log_actor_idx').on(t.actorId, t.createdAt.desc())
	]
);
