import { eq, sql } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { courseAccess, quizAttempts } from '../../db/schema/training-progress';
import type { Actor } from '../users/target';
import { lockMember } from './access-facts';
import { openPortal } from './portal-gate';
import { settleExpired, type QuizDeps } from './quiz-close';
import { drawQuiz } from './quiz-draw';
import { accessOf, attemptsOf, quizBank, quizCourse, quizFacts } from './quiz-facts';
import { quizState } from './quiz-rules';

/* docs/03 section 18.3 p. 1–3: the request row is locked, so two starts (and an extra attempt
 * granted meanwhile) wait for each other. Decisions — docs/todo.md 9.6 (4). No audit (section 18.6). */

export type StartRefusal =
	'not_found' | 'preview' | 'bank' | 'finished' | 'passed' | 'running' | 'membership' | 'wait';
export type StartResult = { ok: true; id: string } | { ok: false; reason: StartRefusal };

const refuse = (reason: StartRefusal) => ({ ok: false, reason }) as const;
/** The partial unique index of one running attempt (`quiz_attempts_running_key`). */
const isDuplicate = (e: unknown) =>
	[e, (e as { cause?: unknown })?.cause].some((x) => (x as { code?: string })?.code === '23505');

async function start(db: LimitDb, courseId: string, userId: string, now: Date) {
	return db.transaction(async (tx): Promise<StartResult> => {
		const access = await accessOf(tx, courseId, userId, true);
		const member = await lockMember(tx, userId);
		const course = await quizCourse(tx, courseId);
		if (access?.status !== 'approved' || member?.status !== 'active') return refuse('not_found');
		if (course?.status !== 'published') return refuse('not_found');
		const attempts = await attemptsOf(tx, courseId, userId);
		const state = quizState(await quizFacts(tx, course, access, attempts, userId, now), now);
		if (state.kind !== 'open') return refuse(state.kind);
		const { bank, topicOrder } = await quizBank(tx, courseId);
		const questions = drawQuiz(bank, topicOrder, course.quizSize);
		if (!questions) return refuse('bank');
		const [row] = await tx
			.insert(quizAttempts)
			.values({
				courseId,
				userId,
				questions,
				total: questions.length,
				passCount: course.passCount,
				isExtra: state.extra,
				startedAt: now,
				expiresAt: new Date(now.getTime() + course.quizMinutes * 60_000)
			})
			.returning({ id: quizAttempts.id });
		if (state.extra) {
			await tx
				.update(courseAccess)
				.set({ extraAttempts: sql`${courseAccess.extraAttempts} - 1` })
				.where(eq(courseAccess.id, access.id));
		}
		return { ok: true, id: row.id };
	});
}

export async function startAttempt(
	db: LimitDb,
	viewer: Actor,
	slug: string,
	deps: QuizDeps
): Promise<StartResult> {
	const gate = await openPortal(db, viewer, slug);
	if (!gate) return refuse('not_found');
	if (gate.preview) return refuse('preview');
	const now = deps.now ?? new Date();
	await settleExpired(db, gate.course.id, viewer.id, deps, now);
	return start(db, gate.course.id, viewer.id, now).catch((e) => {
		if (isDuplicate(e)) return refuse('running');
		throw e;
	});
}
