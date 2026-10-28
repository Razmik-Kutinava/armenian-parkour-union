import { eq } from 'drizzle-orm';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { courseAccess } from '../../db/schema/training-progress';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';
import type { AccessDeps } from './access';
import { lockMember, missingFor, readCourse } from './access-facts';
import { accessDecisionLetter, type AccessDecision } from './access-mail';
import type { AccessMissing } from './access-rules';

/* docs/03 sections 18.1 and 18.6, docs/05 section 27 "Requests"; decisions — docs/todo.md 9.4 (3).
 * Approve and reject only a pending request, revoke only an approved one; approve checks the
 * conditions again. Row lock, audit in the same transaction, the letter after the commit. */

export type DecisionInput = { action: 'approve' } | { action: 'reject' | 'revoke'; reason: string };
export type DecisionResult =
	| { ok: true }
	| { ok: false; reason: 'not_allowed' | 'invalid' | 'not_found' | 'bad_state' }
	| { ok: false; reason: 'conditions'; missing: AccessMissing[] };

const REASON_MAX = 1000;
const STATUS = { approve: 'approved', reject: 'rejected', revoke: 'revoked' } as const;
const refuse = (reason: 'not_allowed' | 'invalid' | 'not_found' | 'bad_state') =>
	({ ok: false, reason }) as const;

async function decide(
	db: LimitDb,
	actor: Actor,
	id: string,
	input: DecisionInput,
	note: string | null,
	deps: AccessDeps,
	now: Date
) {
	return db.transaction(async (tx) => {
		const [row] = await tx.select().from(courseAccess).where(eq(courseAccess.id, id)).for('update');
		if (!row) return refuse('not_found');
		const course = await readCourse(tx, row.courseId);
		const member = await lockMember(tx, row.userId);
		if (!course || !member) return refuse('not_found');
		const from = input.action === 'revoke' ? 'approved' : 'pending';
		if (row.status !== from) return refuse('bad_state');
		if (input.action === 'approve') {
			const missing = await missingFor(tx, course, row.userId, member, now);
			if (missing.length > 0) return { ok: false, reason: 'conditions', missing } as const;
		}
		const status = STATUS[input.action];
		await tx
			.update(courseAccess)
			.set({ status, reviewedBy: actor.id, reviewedAt: now, reviewNote: note })
			.where(eq(courseAccess.id, id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: `course_access.${input.action}`,
			entityType: 'course_access',
			entityId: id,
			before: { status: row.status },
			after: {
				status,
				courseId: row.courseId,
				userId: row.userId,
				...(note ? { reviewNote: note } : {})
			},
			ip: deps.ip
		});
		const decision: AccessDecision =
			input.action === 'approve'
				? { status: 'approved' }
				: { status: STATUS[input.action], reason: note ?? '' };
		const letter = accessDecisionLetter(member, course, decision, deps.siteUrl);
		return { ok: true, letter } as const;
	});
}

export async function decideAccess(
	db: LimitDb,
	actor: Actor,
	id: string,
	input: DecisionInput,
	deps: AccessDeps
): Promise<DecisionResult> {
	if (!roleCan(actor.role, 'training.manage')) return refuse('not_allowed');
	const note = input.action === 'approve' ? null : input.reason.trim();
	if (note !== null && (!note || note.length > REASON_MAX)) return refuse('invalid');
	if (!isUuid(id)) return refuse('not_found');
	const outcome = await decide(db, actor, id, input, note, deps, deps.now ?? new Date());
	if (!outcome.ok) return outcome;
	await deps.send(outcome.letter).catch((e) => console.warn(`course access ${id}: letter`, e));
	return { ok: true };
}
