import { and, eq } from 'drizzle-orm';
import type { QuestionValues } from '#lib/validation/training-questions.ts';
import type { CourseValues, LessonValues } from '#lib/validation/training.ts';
import type { LimitDb } from '../../auth/rate-limit';
import type { UserRole } from '../../auth/session';
import { auditLog } from '../../db/schema/service';
import { courses, courseTopics } from '../../db/schema/training';
import { insertUser } from '../../db/test-db';

/* Test support only: training rows and actors. */

export const IP = '10.0.0.9';
export const PDF = new TextEncoder().encode('%PDF-1.7\n%aaIO\n');

export async function staff(tx: LimitDb, role: UserRole = 'admin') {
	const { id } = await insertUser(tx, { role });
	return { id, role };
}

export const courseValues = (extra: Partial<CourseValues> = {}): CourseValues => ({
	slug: `t-course-${crypto.randomUUID().slice(0, 8)}`,
	examKind: 'trainer',
	title: { en: 'Coach course', ru: 'Курс тренера' },
	description: { en: 'Theory, quiz and practice' },
	status: 'draft',
	quizSize: 27,
	passCount: 25,
	quizMinutes: 60,
	retakeDays: 30,
	attemptsLimit: 3,
	attemptsPeriodDays: 180,
	requiresMembership: true,
	minAge: 18,
	requiredLevel: 'advanced',
	...extra
});

export const lessonValues = (extra: Partial<LessonValues> = {}): LessonValues => ({
	topicId: null,
	title: { en: 'Safety first' },
	body: { en: '<p>Warm up</p>' },
	sortOrder: 0,
	status: 'draft',
	...extra
});

export const questionValues = (
	topicId: string,
	extra: Partial<QuestionValues> = {}
): QuestionValues => ({
	topicId,
	text: { ru: 'Сколько вопросов в тесте Maddocks?' },
	options: [{ ru: '3' }, { ru: '5' }, { ru: '10' }],
	correctIndex: 1,
	source: null,
	...extra
});

export async function insertCourse(tx: LimitDb) {
	const v = courseValues();
	const [row] = await tx
		.insert(courses)
		.values({ slug: v.slug, examKind: v.examKind, title: v.title })
		.returning({ id: courses.id });
	return row.id;
}

export async function insertTopic(tx: LimitDb, courseId: string, sortOrder = 0) {
	const [row] = await tx
		.insert(courseTopics)
		.values({ courseId, title: { en: `Topic ${sortOrder}` }, sortOrder })
		.returning({ id: courseTopics.id });
	return row.id;
}

export const auditOf = (tx: LimitDb, entityType: string, id: string) =>
	tx
		.select()
		.from(auditLog)
		.where(and(eq(auditLog.entityType, entityType), eq(auditLog.entityId, id)))
		.orderBy(auditLog.createdAt);
