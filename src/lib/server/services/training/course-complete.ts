import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { translate } from '#lib/i18n/translate.ts';
import type { PortalText } from '#lib/i18n/localized.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { exams } from '../../db/schema/certification';
import {
	courseAccess,
	practiceSubmissions,
	practiceTasks,
	quizAttempts
} from '../../db/schema/training-progress';
import { users } from '../../db/schema/users';
import type { Mail } from '../../mail/resend';
import { writeAudit } from '../audit';
import { federationEmail } from './access-facts';
import { courseFinishedAdminLetter, courseFinishedLetter } from './course-complete-mail';
import { accessOf, quizCourse } from './quiz-facts';

/* docs/03 sections 18.5–18.6: the course is finished in the transaction of its last event (a
 * passed quiz or an accepted video) — one passed exam, its id in `course_access.exam_id`, audit;
 * letters go after the commit. Decisions — docs/todo.md 9.8 (1–4). */

export type CompleteDeps = { siteUrl: string | undefined; ip: string | null; now: Date };

/** Visible tasks and the accepted ones; `examinerId` — who accepted the latest of them. */
export async function practiceTally(db: LimitDb, courseId: string, userId: string) {
	const tasks = await db
		.select({ id: practiceTasks.id })
		.from(practiceTasks)
		.where(and(eq(practiceTasks.courseId, courseId), isNull(practiceTasks.hiddenAt)));
	if (tasks.length === 0) return { accepted: 0, total: 0, examinerId: null };
	const approved = await db
		.select({ reviewedBy: practiceSubmissions.reviewedBy })
		.from(practiceSubmissions)
		.where(
			and(
				eq(practiceSubmissions.userId, userId),
				eq(practiceSubmissions.status, 'approved'),
				inArray(
					practiceSubmissions.taskId,
					tasks.map((t) => t.id)
				)
			)
		)
		.orderBy(desc(practiceSubmissions.reviewedAt), desc(practiceSubmissions.id));
	return {
		accepted: approved.length,
		total: tasks.length,
		examinerId: approved[0]?.reviewedBy ?? null
	};
}

async function passedAttempt(tx: LimitDb, courseId: string, userId: string) {
	const [row] = await tx
		.select({ correct: quizAttempts.correctCount, total: quizAttempts.total })
		.from(quizAttempts)
		.where(
			and(
				eq(quizAttempts.courseId, courseId),
				eq(quizAttempts.userId, userId),
				eq(quizAttempts.passed, true)
			)
		)
		.limit(1);
	return row ?? null;
}

async function letters(
	tx: LimitDb,
	course: { id: string; slug: string; title: unknown },
	userId: string,
	examId: string,
	deps: CompleteDeps
) {
	const [member] = await tx
		.select({
			email: users.email,
			locale: users.locale,
			firstName: users.firstName,
			lastName: users.lastName,
			name: users.name
		})
		.from(users)
		.where(eq(users.id, userId));
	if (!member) return [];
	const view = { slug: course.slug, title: course.title as PortalText };
	const out: Mail[] = [courseFinishedLetter(member, view, deps.siteUrl)];
	const to = await federationEmail(tx);
	if (to) out.push(courseFinishedAdminLetter(to, member, view, examId, deps.siteUrl));
	else console.warn(`course ${course.id}: no contacts.email, the admin is not told`);
	return out;
}

/** Called inside the transaction of the event; `[]` — the course is not finished by it. */
export async function completeCourse(
	tx: LimitDb,
	courseId: string,
	userId: string,
	actorId: string,
	deps: CompleteDeps
): Promise<Mail[]> {
	const access = await accessOf(tx, courseId, userId, true);
	if (access?.status !== 'approved' || access.examId !== null) return [];
	const quiz = await passedAttempt(tx, courseId, userId);
	if (!quiz) return [];
	const practice = await practiceTally(tx, courseId, userId);
	if (practice.accepted < practice.total) return [];
	const course = await quizCourse(tx, courseId);
	if (!course) return [];
	const correct = quiz.correct ?? 0;
	const score = ((correct / quiz.total) * 100).toFixed(2);
	const notes = translate('en', 'training.exam.notes', {
		correct: String(correct),
		total: String(quiz.total),
		accepted: String(practice.accepted),
		tasks: String(practice.total)
	});
	const values = {
		userId,
		kind: course.examKind,
		result: 'passed' as const,
		score,
		examinerId: practice.examinerId,
		notes,
		scheduledAt: deps.now,
		decidedAt: deps.now
	};
	const [exam] = await tx.insert(exams).values(values).returning({ id: exams.id });
	await tx.update(courseAccess).set({ examId: exam.id }).where(eq(courseAccess.id, access.id));
	await writeAudit(tx, {
		actorId,
		action: 'exam.course_complete',
		entityType: 'exam',
		entityId: exam.id,
		after: { kind: values.kind, score, courseId, userId, examinerId: values.examinerId, notes },
		ip: deps.ip
	});
	return letters(tx, course, userId, exam.id, deps);
}
