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
	uniqueIndex,
	uuid,
	type AnyPgColumn
} from 'drizzle-orm/pg-core';
import { pointsReason } from './enums';
import { users } from './users';

/* docs/02-DATABASE.md section 5; `created_at` on rules and unique `reversal_of_id` — decisions.md 2026-10-20 (4.1). */

const createdAt = timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const pointsRules = pgTable('points_rules', {
	id: uuid('id').primaryKey().defaultRandom(),
	code: text('code').notNull().unique(),
	title: jsonb('title').notNull(),
	points: integer('points').notNull(),
	isActive: boolean('is_active').notNull().default(true),
	updatedBy: uuid('updated_by').references(() => users.id),
	createdAt,
	updatedAt: timestamp('updated_at', { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date())
});

/** Append-only: UPDATE, DELETE and TRUNCATE are rejected by a trigger (migration 0009). */
export const pointsLedger = pgTable(
	'points_ledger',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id),
		delta: integer('delta').notNull(),
		reason: pointsReason('reason').notNull(),
		ruleId: uuid('rule_id').references(() => pointsRules.id),
		sourceType: text('source_type'),
		sourceId: uuid('source_id'),
		comment: text('comment'),
		reversalOfId: uuid('reversal_of_id').references((): AnyPgColumn => pointsLedger.id),
		createdBy: uuid('created_by').references(() => users.id),
		createdAt
	},
	(t) => [
		index('points_ledger_user_created_idx').on(t.userId, t.createdAt.desc()),
		index('points_ledger_source_idx').on(t.sourceType, t.sourceId),
		uniqueIndex('points_ledger_source_once_key')
			.on(t.userId, t.reason, t.sourceType, t.sourceId)
			.where(sql`${t.reason} NOT IN ('manual', 'reversal') AND ${t.sourceId} IS NOT NULL`),
		uniqueIndex('points_ledger_reversal_once_key')
			.on(t.reversalOfId)
			.where(sql`${t.reversalOfId} IS NOT NULL`),
		check('points_ledger_delta_non_zero', sql`${t.delta} <> 0`),
		check(
			'points_ledger_comment_required',
			sql`${t.reason} NOT IN ('manual', 'reversal') OR btrim(coalesce(${t.comment}, '')) <> ''`
		),
		check(
			'points_ledger_reversal_link',
			sql`(${t.reason} = 'reversal') = (${t.reversalOfId} IS NOT NULL)`
		)
	]
);
