import { and, eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { quizAttempts } from '../../db/schema/training-progress';
import { isUuid, type Actor } from '../users/target';
import { openPortal } from './portal-gate';
import { closeAttempt, normalizeAnswers, sendLetters, type QuizDeps } from './quiz-close';
import type { SnapshotQuestion } from './quiz-draw';
import { accessOf } from './quiz-facts';

/* docs/03 section 18.3 p. 4–6, docs/06 section 5.11 "Quiz": answers saved on the way, the result
 * counted once under the row lock; past the time the posted answers are refused and the saved
 * ones count. Only the member's own attempt of this course. Decisions — docs/todo.md 9.6 (5). */

export type SaveResult = { ok: true } | { ok: false; reason: 'not_found' | 'expired' };
export type SubmitResult =
	| { ok: true; correct: number; total: number; passed: boolean; expired: boolean }
	| { ok: false; reason: 'not_found' };

const notFound = { ok: false, reason: 'not_found' } as const;

async function lockOwn(tx: LimitDb, courseId: string, userId: string, id: string) {
	const [row] = await tx
		.select()
		.from(quizAttempts)
		.where(
			and(
				eq(quizAttempts.id, id),
				eq(quizAttempts.userId, userId),
				eq(quizAttempts.courseId, courseId)
			)
		)
		.for('update');
	return row ?? null;
}

/** The course of a member taking the quiz: preview and no access — nothing. */
async function takerCourse(db: LimitDb, viewer: Actor, slug: string, attemptId: string) {
	if (!isUuid(attemptId)) return null;
	const gate = await openPortal(db, viewer, slug);
	return gate && !gate.preview ? gate.course.id : null;
}

export async function saveAnswers(
	db: LimitDb,
	viewer: Actor,
	slug: string,
	attemptId: string,
	answers: readonly unknown[],
	deps: QuizDeps
): Promise<SaveResult> {
	const courseId = await takerCourse(db, viewer, slug, attemptId);
	if (!courseId) return notFound;
	const now = deps.now ?? new Date();
	return db.transaction(async (tx): Promise<SaveResult> => {
		const row = await lockOwn(tx, courseId, viewer.id, attemptId);
		if (!row) return notFound;
		if (row.passed !== null || row.expiresAt <= now) return { ok: false, reason: 'expired' };
		const saved = normalizeAnswers(row.questions as SnapshotQuestion[], answers);
		await tx.update(quizAttempts).set({ answers: saved }).where(eq(quizAttempts.id, row.id));
		return { ok: true };
	});
}

export async function submitAttempt(
	db: LimitDb,
	viewer: Actor,
	slug: string,
	attemptId: string,
	answers: readonly unknown[],
	deps: QuizDeps
): Promise<SubmitResult> {
	const courseId = await takerCourse(db, viewer, slug, attemptId);
	if (!courseId) return notFound;
	const now = deps.now ?? new Date();
	const outcome = await db.transaction(async (tx) => {
		/* The same lock order as the start: the access row, then the attempt. */
		await accessOf(tx, courseId, viewer.id, true);
		const row = await lockOwn(tx, courseId, viewer.id, attemptId);
		if (!row) return null;
		if (row.passed !== null) {
			const expired = row.submittedAt !== null && row.submittedAt >= row.expiresAt;
			const result = { correct: row.correctCount ?? 0, total: row.total, passed: row.passed };
			return { result, expired, letters: [] };
		}
		const expired = row.expiresAt <= now;
		const questions = row.questions as SnapshotQuestion[];
		const final = normalizeAnswers(questions, expired ? (row.answers ?? []) : answers);
		const closed = await closeAttempt(tx, row, final, expired ? row.expiresAt : now, deps, now);
		return { ...closed, expired };
	});
	if (!outcome) return notFound;
	await sendLetters(deps, outcome.letters, attemptId);
	const { correct, total, passed } = outcome.result;
	return { ok: true, correct, total, passed, expired: outcome.expired };
}
