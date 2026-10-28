import { and, eq, isNull, lte } from 'drizzle-orm';
import type { PortalText } from '#lib/i18n/localized.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { quizAttempts } from '../../db/schema/training-progress';
import { users } from '../../db/schema/users';
import type { Mail } from '../../mail/resend';
import type { SnapshotQuestion } from './quiz-draw';
import { accessOf, attemptsOf, quizCourse, type AttemptRow } from './quiz-facts';
import { quizResultLetter, type QuizResult } from './quiz-mail';
import { regularFrom } from './quiz-rules';

/* docs/03 section 18.3 p. 4–6: the result is counted on the server from the snapshot; an attempt
 * past its time closes with the answers saved so far (empty — wrong). Decisions — docs/todo.md
 * 9.6 (3, 5, 7). The letter is built in the transaction and sent after the commit. */

export type QuizDeps = {
	send: (mail: Mail) => Promise<void>;
	siteUrl: string | undefined;
	now?: Date;
};
export type Answers = (number | null)[];

/** One answer per question: an option number inside the question, anything else — empty. */
export function normalizeAnswers(
	questions: SnapshotQuestion[],
	answers: readonly unknown[]
): Answers {
	return questions.map((q, i) => {
		const value = answers[i];
		const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
		return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < q.options.length
			? n
			: null;
	});
}

async function resultLetter(
	tx: LimitDb,
	row: AttemptRow,
	result: QuizResult,
	now: Date,
	siteUrl?: string
) {
	const course = await quizCourse(tx, row.courseId);
	const [member] = await tx
		.select({
			email: users.email,
			locale: users.locale,
			firstName: users.firstName,
			name: users.name
		})
		.from(users)
		.where(eq(users.id, row.userId));
	if (!course || !member) return null;
	let retakeAt: Date | null = null;
	if (!result.passed) {
		const access = await accessOf(tx, row.courseId, row.userId);
		const attempts = await attemptsOf(tx, row.courseId, row.userId);
		const extraAttempts = access?.extraAttempts ?? 0;
		const facts = { settings: course, attempts, extraAttempts, finished: false, membership: true };
		retakeAt = extraAttempts > 0 ? null : regularFrom(facts, now);
	}
	const title = course.title as PortalText;
	return quizResultLetter(member, { slug: course.slug, title }, result, retakeAt, siteUrl);
}

/** `row` is locked and running. */
export async function closeAttempt(
	tx: LimitDb,
	row: AttemptRow,
	answers: Answers,
	at: Date,
	deps: QuizDeps,
	now: Date
) {
	const questions = row.questions as SnapshotQuestion[];
	const correct = questions.filter((q, i) => answers[i] === q.correct_index).length;
	const passed = correct >= row.passCount;
	await tx
		.update(quizAttempts)
		.set({ answers, correctCount: correct, passed, submittedAt: at })
		.where(eq(quizAttempts.id, row.id));
	const result = { correct, total: row.total, passCount: row.passCount, passed };
	return { result, letter: await resultLetter(tx, row, result, now, deps.siteUrl) };
}

export async function sendLetter(deps: QuizDeps, letter: Mail | null, id: string) {
	if (letter) await deps.send(letter).catch((e) => console.warn(`quiz attempt ${id}: letter`, e));
}

/** Closes the member's attempts past their time; called before every read and write of the quiz. */
export async function settleExpired(
	db: LimitDb,
	courseId: string,
	userId: string,
	deps: QuizDeps,
	now: Date
) {
	const closed = await db.transaction(async (tx) => {
		const rows = await tx
			.select()
			.from(quizAttempts)
			.where(
				and(
					eq(quizAttempts.courseId, courseId),
					eq(quizAttempts.userId, userId),
					isNull(quizAttempts.passed),
					lte(quizAttempts.expiresAt, now)
				)
			)
			.for('update');
		const out: { id: string; letter: Mail | null }[] = [];
		for (const row of rows) {
			const answers = normalizeAnswers(row.questions as SnapshotQuestion[], row.answers ?? []);
			const { letter } = await closeAttempt(tx, row, answers, row.expiresAt, deps, now);
			out.push({ id: row.id, letter });
		}
		return out;
	});
	for (const { id, letter } of closed) await sendLetter(deps, letter, id);
}
