import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	index,
	jsonb,
	pgTable,
	smallint,
	text,
	timestamp,
	unique,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';
import { exams } from './certification';
import { practiceStatus, trainingAccessStatus } from './enums';
import { courses } from './training';
import { users } from './users';

/* docs/02-DATABASE.md section 11 (member progress); notes, one live row, result — todo.md 9.1. */

export const practicePlatforms = ['youtube', 'google_drive'] as const;

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
	timestamp('updated_at', { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date());

/** One row per course and member; applying again after a refusal returns it to `pending`. */
export const courseAccess = pgTable(
	'course_access',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		courseId: uuid('course_id')
			.notNull()
			.references(() => courses.id),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id),
		status: trainingAccessStatus('status').notNull().default('pending'),
		reviewedBy: uuid('reviewed_by').references(() => users.id),
		reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
		/** Shown to the member; required for `rejected` and `revoked`. */
		reviewNote: text('review_note'),
		/** Granted by an admin, not used yet: no pause and no limit. */
		extraAttempts: smallint('extra_attempts').notNull().default(0),
		/** The course exam; set — the course is finished, never twice (docs/03 section 18.5). */
		examId: uuid('exam_id')
			.unique()
			.references(() => exams.id),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		unique('course_access_course_id_user_id_key').on(t.courseId, t.userId),
		index('course_access_status_created_at_idx').on(t.status, t.createdAt),
		check('course_access_extra_attempts', sql`${t.extraAttempts} >= 0`),
		check(
			'course_access_review_note',
			sql`${t.status} NOT IN ('rejected', 'revoked') OR btrim(coalesce(${t.reviewNote}, '')) <> ''`
		),
		check('course_access_reviewed_at', sql`(${t.status} = 'pending') = (${t.reviewedAt} IS NULL)`)
	]
);

/** Questions and correct answers are a snapshot taken at the start; `passed` null — running. */
export const quizAttempts = pgTable(
	'quiz_attempts',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		courseId: uuid('course_id')
			.notNull()
			.references(() => courses.id),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id),
		/** `[{question_id, text, options, correct_index}]`; `correct_index` never goes to the browser. */
		questions: jsonb('questions').notNull(),
		answers: jsonb('answers').$type<(number | null)[]>(),
		total: smallint('total').notNull(),
		passCount: smallint('pass_count').notNull(),
		correctCount: smallint('correct_count'),
		passed: boolean('passed'),
		/** Out of the attempts limit. */
		isExtra: boolean('is_extra').notNull().default(false),
		startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		/** Sent or expired. */
		submittedAt: timestamp('submitted_at', { withTimezone: true }),
		createdAt: createdAt()
	},
	(t) => [
		uniqueIndex('quiz_attempts_running_key')
			.on(t.courseId, t.userId)
			.where(sql`${t.passed} IS NULL`),
		index('quiz_attempts_user_id_course_id_started_at_idx').on(
			t.userId,
			t.courseId,
			t.startedAt.desc()
		),
		check('quiz_attempts_questions_array', sql`jsonb_typeof(${t.questions}) = 'array'`),
		check(
			'quiz_attempts_answers_array',
			sql`${t.answers} IS NULL OR jsonb_typeof(${t.answers}) = 'array'`
		),
		check('quiz_attempts_counts', sql`${t.total} >= 1 AND ${t.passCount} BETWEEN 1 AND ${t.total}`),
		check('quiz_attempts_expires_after_start', sql`${t.expiresAt} > ${t.startedAt}`),
		check(
			'quiz_attempts_result',
			sql`(${t.passed} IS NULL) = (${t.correctCount} IS NULL)
				AND (${t.passed} IS NULL) = (${t.submittedAt} IS NULL)
				AND (${t.passed} IS NULL OR (${t.correctCount} BETWEEN 0 AND ${t.total}
					AND ${t.passed} = (${t.correctCount} >= ${t.passCount})))`
		)
	]
);

/** A hidden task is not required to finish the course. */
export const practiceTasks = pgTable('practice_tasks', {
	id: uuid('id').primaryKey().defaultRandom(),
	courseId: uuid('course_id')
		.notNull()
		.references(() => courses.id),
	title: jsonb('title').notNull(),
	/** What to show, video requirements and criteria (sanitized HTML). */
	description: jsonb('description').notNull(),
	sortOrder: smallint('sort_order').notNull().default(0),
	hiddenAt: timestamp('hidden_at', { withTimezone: true }),
	createdAt: createdAt(),
	updatedAt: updatedAt()
});

/** A link only; a retake is a new row. Not public and no points, unlike `videos`. */
export const practiceSubmissions = pgTable(
	'practice_submissions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		taskId: uuid('task_id')
			.notNull()
			.references(() => practiceTasks.id),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id),
		/** Normalized. */
		url: text('url').notNull(),
		platform: text('platform', { enum: practicePlatforms }).notNull(),
		status: practiceStatus('status').notNull().default('pending'),
		reviewedBy: uuid('reviewed_by').references(() => users.id),
		reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
		/** Required for `rejected`. */
		reviewNote: text('review_note'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		uniqueIndex('practice_submissions_live_key')
			.on(t.taskId, t.userId)
			.where(sql`${t.status} IN ('pending', 'approved')`),
		index('practice_submissions_status_created_at_idx').on(t.status, t.createdAt),
		index('practice_submissions_user_id_idx').on(t.userId),
		check('practice_submissions_platform', sql`${t.platform} IN ('youtube', 'google_drive')`),
		check(
			'practice_submissions_review_note',
			sql`${t.status} <> 'rejected' OR btrim(coalesce(${t.reviewNote}, '')) <> ''`
		),
		check(
			'practice_submissions_reviewed_at',
			sql`(${t.status} = 'pending') = (${t.reviewedAt} IS NULL)`
		)
	]
);
