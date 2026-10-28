import { and, eq, inArray } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { practiceSubmissions } from '../../db/schema/training-progress';
import type { Actor } from '../users/target';
import { openPortal } from './portal-gate';
import { quizPassed, visibleTask } from './practice-facts';
import { normalizePracticeUrl } from './practice-link';
import { accessOf } from './quiz-facts';

/* docs/03 sections 18.1 p. 4 and 18.4 p. 1–3: a link per visible task after the passed quiz; one
 * pending or approved at a time, a pending link is replaced. The member's own action: no audit, no
 * letter. Decisions — docs/todo.md 9.7 (3). */

export type SubmitRefusal = 'not_found' | 'preview' | 'bad_url' | 'finished' | 'quiz' | 'bad_state';
export type SubmitResult = { ok: true; replaced: boolean } | { ok: false; reason: SubmitRefusal };

const refuse = (reason: SubmitRefusal) => ({ ok: false, reason }) as const;

export async function submitPractice(
	db: LimitDb,
	viewer: Actor,
	slug: string,
	taskId: string,
	rawUrl: string
): Promise<SubmitResult> {
	const gate = await openPortal(db, viewer, slug);
	if (!gate) return refuse('not_found');
	if (gate.preview) return refuse('preview');
	const link = normalizePracticeUrl(rawUrl);
	if (!link) return refuse('bad_url');
	const courseId = gate.course.id;
	return db.transaction(async (tx): Promise<SubmitResult> => {
		const access = await accessOf(tx, courseId, viewer.id, true);
		if (access?.status !== 'approved') return refuse('not_found');
		if (access.examId !== null) return refuse('finished');
		if (!(await quizPassed(tx, courseId, viewer.id))) return refuse('quiz');
		if (!(await visibleTask(tx, courseId, taskId))) return refuse('not_found');
		const [live] = await tx
			.select({ id: practiceSubmissions.id, status: practiceSubmissions.status })
			.from(practiceSubmissions)
			.where(
				and(
					eq(practiceSubmissions.taskId, taskId),
					eq(practiceSubmissions.userId, viewer.id),
					inArray(practiceSubmissions.status, ['pending', 'approved'])
				)
			)
			.for('update');
		if (live?.status === 'approved') return refuse('bad_state');
		if (live) {
			await tx.update(practiceSubmissions).set(link).where(eq(practiceSubmissions.id, live.id));
			return { ok: true, replaced: true };
		}
		await tx.insert(practiceSubmissions).values({ taskId, userId: viewer.id, ...link });
		return { ok: true, replaced: false };
	});
}
