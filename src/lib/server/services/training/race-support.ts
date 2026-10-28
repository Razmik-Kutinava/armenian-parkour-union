import { inArray } from 'drizzle-orm';
import { exams } from '../../db/schema/certification';
import { memberships } from '../../db/schema/payments';
import { courses, courseTopics, quizQuestions } from '../../db/schema/training';
import {
	courseAccess,
	practiceSubmissions,
	practiceTasks,
	quizAttempts
} from '../../db/schema/training-progress';
import { users } from '../../db/schema/users';
import { raceDb } from '../registrations/race-support';
import { practiceCourse } from './practice-test-support';
import { quizCourse } from './quiz-test-support';

/* Test support only: simultaneous clicks on the portal. Sessions and `race` — registrations/
 * race-support.ts; the portal rows committed here are deleted by course, the exams by their access
 * rows, the members soft-deleted; audit entries stay (append-only). */

export function portalRaceDb(sessions = 3) {
	const base = raceDb(sessions);
	const { main } = base;
	const courseIds: string[] = [];
	const userIds: string[] = [];

	function track<T extends { course: { id: string }; user: { id: string } }>(ctx: T) {
		courseIds.push(ctx.course.id);
		userIds.push(ctx.user.id);
		return ctx;
	}

	async function cleanup() {
		try {
			if (courseIds.length) {
				const tasks = await main
					.select({ id: practiceTasks.id })
					.from(practiceTasks)
					.where(inArray(practiceTasks.courseId, courseIds));
				const taskIds = tasks.map((t) => t.id);
				if (taskIds.length) {
					await main
						.delete(practiceSubmissions)
						.where(inArray(practiceSubmissions.taskId, taskIds));
				}
				await main.delete(practiceTasks).where(inArray(practiceTasks.courseId, courseIds));
				await main.delete(quizAttempts).where(inArray(quizAttempts.courseId, courseIds));
				const access = await main
					.delete(courseAccess)
					.where(inArray(courseAccess.courseId, courseIds))
					.returning({ examId: courseAccess.examId });
				const examIds = access.flatMap((a) => (a.examId ? [a.examId] : []));
				if (examIds.length) await main.delete(exams).where(inArray(exams.id, examIds));
				await main.delete(quizQuestions).where(inArray(quizQuestions.courseId, courseIds));
				await main.delete(courseTopics).where(inArray(courseTopics.courseId, courseIds));
				await main.delete(courses).where(inArray(courses.id, courseIds));
			}
			if (userIds.length) {
				await main.delete(memberships).where(inArray(memberships.userId, userIds));
				await main.update(users).set({ deletedAt: new Date() }).where(inArray(users.id, userIds));
			}
		} finally {
			await base.cleanup();
		}
	}

	return {
		...base,
		cleanup,
		/** A published course with a quiz of 4 and an approved member, committed. */
		quiz: async (extra: Parameters<typeof quizCourse>[1] = {}) =>
			track(await quizCourse(main, extra)),
		/** The same with two visible tasks (and a passed quiz unless `passed: false`), committed. */
		practice: async (options: Parameters<typeof practiceCourse>[1] = {}) =>
			track(await practiceCourse(main, options))
	};
}
