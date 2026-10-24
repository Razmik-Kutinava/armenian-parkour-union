import { eq } from 'drizzle-orm';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { exams } from '../../db/schema/certification';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';
import { EXAM_NOTES_MAX } from './schedule';

/* docs/03 section 4.2, docs/05 section 7: a moderator or an admin records the result once. A pass
 * only opens the certificate (6.3); the level is never changed here. */

export type ExamResultInput = {
	examId: string;
	result: 'passed' | 'failed' | 'cancelled';
	/** numeric(5,2): 0–999.99; not for a cancelled exam. */
	score?: number | null;
	/** Added to the exam notes. */
	comment?: string | null;
};

export type ExamResultOutcome =
	'ok' | 'not_allowed' | 'invalid' | 'not_found' | 'already_decided' | 'too_early';

const RESULTS = ['passed', 'failed', 'cancelled'];

function parseScore(input: ExamResultInput): { score: string | null } | null {
	const score = input.score ?? null;
	if (score === null) return { score: null };
	if (input.result === 'cancelled' || !Number.isFinite(score)) return null;
	const cents = Math.round(score * 100);
	if (cents < 0 || cents > 99_999 || Math.abs(score * 100 - cents) > 1e-6) return null;
	return { score: (cents / 100).toFixed(2) };
}

export async function recordExamResult(
	db: LimitDb,
	actor: Actor,
	input: ExamResultInput,
	ip: string | null,
	now = new Date()
): Promise<ExamResultOutcome> {
	if (!roleCan(actor.role, 'exams.manage')) return 'not_allowed';
	if (!RESULTS.includes(input.result)) return 'invalid';
	const parsed = parseScore(input);
	const comment = input.comment?.trim() || null;
	if (!parsed || (comment && comment.length > EXAM_NOTES_MAX)) return 'invalid';
	if (!isUuid(input.examId)) return 'not_found';
	return db.transaction(async (tx) => {
		const [row] = await tx.select().from(exams).where(eq(exams.id, input.examId)).for('update');
		if (!row) return 'not_found';
		if (row.result !== 'scheduled') return 'already_decided';
		const held = input.result !== 'cancelled';
		if (held && row.scheduledAt && now < row.scheduledAt) return 'too_early';
		const examinerId = held ? (row.examinerId ?? actor.id) : row.examinerId;
		const notes = [row.notes, comment].filter(Boolean).join('\n\n') || null;
		await tx
			.update(exams)
			.set({ result: input.result, score: parsed.score, examinerId, notes, decidedAt: now })
			.where(eq(exams.id, row.id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'exam.result',
			entityType: 'exam',
			entityId: row.id,
			before: { result: row.result },
			after: {
				result: input.result,
				score: parsed.score,
				userId: row.userId,
				kind: row.kind,
				examinerId
			},
			ip
		});
		return 'ok';
	});
}
