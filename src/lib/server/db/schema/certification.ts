import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	index,
	jsonb,
	numeric,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';
import {
	certificateKind,
	certificateStatus,
	examKind,
	examResult,
	membershipLevel,
	staffKind
} from './enums';
import { events } from './events';
import { users } from './users';

/* docs/02-DATABASE.md sections 1–2; `created_at` / `updated_at` — its general conventions. */

const timestamps = {
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date())
};

/** Trainer or judge: created and deactivated with the matching certificate, not a role. */
export const staffProfiles = pgTable(
	'staff_profiles',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id),
		kind: staffKind('kind').notNull(),
		category: text('category'),
		licenseNumber: text('license_number'),
		bio: jsonb('bio'),
		isPublic: boolean('is_public').notNull().default(false),
		isActive: boolean('is_active').notNull().default(true),
		...timestamps
	},
	(t) => [uniqueIndex('staff_profiles_user_id_kind_key').on(t.userId, t.kind)]
);

/** A retake is a new row. */
export const exams = pgTable(
	'exams',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id),
		kind: examKind('kind').notNull(),
		eventId: uuid('event_id').references(() => events.id),
		scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
		result: examResult('result').notNull().default('scheduled'),
		score: numeric('score', { precision: 5, scale: 2 }),
		examinerId: uuid('examiner_id').references(() => users.id),
		notes: text('notes'),
		decidedAt: timestamp('decided_at', { withTimezone: true }),
		...timestamps
	},
	(t) => [
		index('exams_user_id_idx').on(t.userId),
		index('exams_result_scheduled_at_idx').on(t.result, t.scheduledAt)
	]
);

/** `users.level` changes with a level certificate in the same transaction (docs/03 section 4). */
export const certificates = pgTable(
	'certificates',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id),
		kind: certificateKind('kind').notNull(),
		level: membershipLevel('level'),
		category: text('category'),
		/** `APU-{year}-{0001}`, never reused. */
		number: text('number').notNull().unique(),
		publicToken: text('public_token').notNull().unique(),
		status: certificateStatus('status').notNull().default('active'),
		issuedAt: timestamp('issued_at', { withTimezone: true }).notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }),
		examId: uuid('exam_id').references(() => exams.id),
		issuedBy: uuid('issued_by')
			.notNull()
			.references(() => users.id),
		fileKey: text('file_key'),
		revokedAt: timestamp('revoked_at', { withTimezone: true }),
		revokeReason: text('revoke_reason'),
		...timestamps
	},
	(t) => [
		index('certificates_user_id_idx').on(t.userId),
		index('certificates_kind_status_idx').on(t.kind, t.status),
		/** A double submit must not issue twice (twice the points). */
		uniqueIndex('certificates_exam_id_live_key')
			.on(t.examId)
			.where(sql`${t.examId} IS NOT NULL AND ${t.status} <> 'revoked'`),
		uniqueIndex('certificates_user_id_level_live_key')
			.on(t.userId, t.level)
			.where(sql`${t.kind} = 'level' AND ${t.status} <> 'revoked'`),
		check(
			'certificates_level_kind',
			sql`(${t.kind} = 'level') = (${t.level} IS NOT NULL) AND ${t.level} IS DISTINCT FROM 'novice'`
		),
		check('certificates_level_no_expiry', sql`${t.kind} <> 'level' OR ${t.expiresAt} IS NULL`),
		check(
			'certificates_revoked_reason',
			sql`(${t.status} = 'revoked') = (${t.revokedAt} IS NOT NULL)
				AND (${t.status} <> 'revoked' OR btrim(coalesce(${t.revokeReason}, '')) <> '')`
		)
	]
);
