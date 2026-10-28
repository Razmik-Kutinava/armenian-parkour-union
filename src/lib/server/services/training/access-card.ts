import { and, desc, eq } from 'drizzle-orm';
import type { PortalText } from '#lib/i18n/localized.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { courses } from '../../db/schema/training';
import { courseAccess, quizAttempts } from '../../db/schema/training-progress';
import { users } from '../../db/schema/users';
import { isUuid } from '../users/target';
import { attemptColumns, typed } from './attempt-list';
import { practiceStatus } from './practice-read';

/* docs/05 section 27 "Requests": the member card in a request — quiz attempts, practice status by
 * visible task, the exam link when the course is finished. Reads only. Decisions — docs/todo.md 9.12. */

async function attemptsIn(db: LimitDb, courseId: string, userId: string, now: Date) {
	const rows = await db
		.select(attemptColumns)
		.from(quizAttempts)
		.innerJoin(courses, eq(courses.id, quizAttempts.courseId))
		.innerJoin(users, eq(users.id, quizAttempts.userId))
		.where(and(eq(quizAttempts.courseId, courseId), eq(quizAttempts.userId, userId)))
		.orderBy(desc(quizAttempts.startedAt), desc(quizAttempts.id));
	return rows.map((r) => {
		const { id, startedAt, correctCount, total, isExtra, result } = typed(r, now);
		return { id, startedAt, correctCount, total, isExtra, result };
	});
}

export async function accessDetail(db: LimitDb, id: string, now = new Date()) {
	if (!isUuid(id)) return null;
	const [row] = await db
		.select({
			id: courseAccess.id,
			userId: courseAccess.userId,
			name: users.name,
			courseId: courseAccess.courseId,
			slug: courses.slug,
			courseTitle: courses.title,
			description: courses.description,
			status: courseAccess.status,
			createdAt: courseAccess.createdAt,
			reviewedAt: courseAccess.reviewedAt,
			reviewNote: courseAccess.reviewNote,
			extraAttempts: courseAccess.extraAttempts,
			examId: courseAccess.examId
		})
		.from(courseAccess)
		.innerJoin(users, eq(users.id, courseAccess.userId))
		.innerJoin(courses, eq(courses.id, courseAccess.courseId))
		.where(eq(courseAccess.id, id));
	if (!row) return null;
	const { slug, description, ...rest } = row;
	const courseTitle = row.courseTitle as PortalText;
	const course = {
		id: row.courseId,
		slug,
		title: courseTitle,
		description: description as PortalText
	};
	const [attempts, practice] = await Promise.all([
		attemptsIn(db, row.courseId, row.userId, now),
		practiceStatus(db, { course, preview: false }, row.userId)
	]);
	return {
		...rest,
		courseTitle,
		attempts,
		practice: {
			accepted: practice.accepted,
			total: practice.total,
			tasks: practice.tasks.map((t) => ({
				id: t.id,
				title: t.title,
				current: t.current && { id: t.current.id, status: t.current.status },
				count: t.history.length
			}))
		}
	};
}
export type AccessCard = NonNullable<Awaited<ReturnType<typeof accessDetail>>>;
