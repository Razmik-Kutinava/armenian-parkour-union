import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	foreignKey,
	index,
	jsonb,
	pgTable,
	smallint,
	text,
	timestamp,
	unique,
	uuid
} from 'drizzle-orm/pg-core';
import { contentStatus, examKind, membershipLevel } from './enums';
import { users } from './users';

/* docs/02-DATABASE.md section 11 (course content); NOT NULL, checks, same-course topic — todo.md 9.1. */

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
	timestamp('updated_at', { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date());

/** Quiz and admission settings are edited in the admin (docs/03 section 18). */
export const courses = pgTable(
	'courses',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		slug: text('slug').notNull().unique(),
		examKind: examKind('exam_kind').notNull(),
		title: jsonb('title').notNull(),
		description: jsonb('description').notNull().default({}),
		status: contentStatus('status').notNull().default('draft'),
		quizSize: smallint('quiz_size').notNull().default(27),
		passCount: smallint('pass_count').notNull().default(25),
		quizMinutes: smallint('quiz_minutes').notNull().default(60),
		retakeDays: smallint('retake_days').notNull().default(30),
		attemptsLimit: smallint('attempts_limit').notNull().default(3),
		/** Sliding window of the attempts limit. */
		attemptsPeriodDays: smallint('attempts_period_days').notNull().default(180),
		requiresMembership: boolean('requires_membership').notNull().default(true),
		minAge: smallint('min_age'),
		requiredLevel: membershipLevel('required_level'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		check(
			'courses_quiz_numbers',
			sql`${t.quizSize} >= 1 AND ${t.passCount} BETWEEN 1 AND ${t.quizSize}`
		),
		check('courses_quiz_minutes_positive', sql`${t.quizMinutes} >= 1`),
		check('courses_retake_days_not_negative', sql`${t.retakeDays} >= 0`),
		check(
			'courses_attempts_positive',
			sql`${t.attemptsLimit} >= 1 AND ${t.attemptsPeriodDays} >= 1`
		),
		check('courses_min_age_positive', sql`${t.minAge} IS NULL OR ${t.minAge} >= 1`)
	]
);

/** A hidden topic is out of the quiz and the portal. */
export const courseTopics = pgTable(
	'course_topics',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		courseId: uuid('course_id')
			.notNull()
			.references(() => courses.id),
		title: jsonb('title').notNull(),
		sortOrder: smallint('sort_order').notNull().default(0),
		hiddenAt: timestamp('hidden_at', { withTimezone: true }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [unique('course_topics_course_id_id_key').on(t.courseId, t.id)]
);

/** PDF in the private bucket: `training/<course id>/<uuid>.pdf`. */
export const courseLessons = pgTable(
	'course_lessons',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		courseId: uuid('course_id')
			.notNull()
			.references(() => courses.id),
		topicId: uuid('topic_id'),
		title: jsonb('title').notNull(),
		/** Sanitized HTML per language, like `posts.body`. */
		body: jsonb('body'),
		fileKey: text('file_key'),
		fileName: text('file_name'),
		sortOrder: smallint('sort_order').notNull().default(0),
		status: contentStatus('status').notNull().default('draft'),
		createdBy: uuid('created_by').references(() => users.id),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
		deletedAt: timestamp('deleted_at', { withTimezone: true })
	},
	(t) => [
		/** A topic of the lesson's own course only. */
		foreignKey({
			name: 'course_lessons_topic_same_course_fk',
			columns: [t.courseId, t.topicId],
			foreignColumns: [courseTopics.courseId, courseTopics.id]
		}),
		index('course_lessons_course_id_sort_order_idx').on(t.courseId, t.sortOrder),
		check('course_lessons_file', sql`(${t.fileKey} IS NULL) = (${t.fileName} IS NULL)`)
	]
);

/** Hidden, never deleted: attempts keep a snapshot, statistics keep the `id`. */
export const quizQuestions = pgTable(
	'quiz_questions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		courseId: uuid('course_id')
			.notNull()
			.references(() => courses.id),
		topicId: uuid('topic_id').notNull(),
		text: jsonb('text').notNull(),
		/** `[{en, hy, ru}, …]`, 2 to 6 options. */
		options: jsonb('options').notNull(),
		/** From 0, inside `options`. */
		correctIndex: smallint('correct_index').notNull(),
		source: text('source'),
		hiddenAt: timestamp('hidden_at', { withTimezone: true }),
		createdBy: uuid('created_by').references(() => users.id),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		foreignKey({
			name: 'quiz_questions_topic_same_course_fk',
			columns: [t.courseId, t.topicId],
			foreignColumns: [courseTopics.courseId, courseTopics.id]
		}),
		index('quiz_questions_course_id_topic_id_idx')
			.on(t.courseId, t.topicId)
			.where(sql`${t.hiddenAt} IS NULL`),
		check(
			'quiz_questions_options',
			sql`CASE WHEN jsonb_typeof(${t.options}) = 'array'
				THEN jsonb_array_length(${t.options}) BETWEEN 2 AND 6
					AND ${t.correctIndex} >= 0 AND ${t.correctIndex} < jsonb_array_length(${t.options})
				ELSE false END`
		)
	]
);
