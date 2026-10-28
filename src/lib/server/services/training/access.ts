import { and, eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { courseAccess } from '../../db/schema/training-progress';
import type { Mail } from '../../mail/resend';
import { isUuid } from '../users/target';
import { federationEmail, lockMember, missingFor, readCourse } from './access-facts';
import { accessRequestLetter } from './access-mail';
import type { AccessMissing } from './access-rules';

export { decideAccess, type DecisionInput, type DecisionResult } from './access-decision';

/* docs/03 section 18.1, docs/06 section 5.11; decisions — docs/todo.md 9.4 (2). A member applies
 * for a published course; the conditions are checked here and again at approval. Only decisions
 * go to the audit log (docs/03 section 18.6). The letter waits for the commit. */

export type AccessDeps = {
	send: (mail: Mail) => Promise<void>;
	siteUrl: string | undefined;
	ip: string | null;
	now?: Date;
};
export type ApplyResult =
	| { ok: true; id: string }
	| { ok: false; reason: 'not_found' | 'blocked' | 'bad_state' }
	| { ok: false; reason: 'conditions'; missing: AccessMissing[] };

const refuse = (reason: 'not_found' | 'blocked' | 'bad_state') => ({ ok: false, reason }) as const;

/** One row per course and member (`course_access_course_id_user_id_key`): a parallel request. */
const isDuplicate = (e: unknown) =>
	[e, (e as { cause?: unknown })?.cause].some((x) => (x as { code?: string })?.code === '23505');

async function apply(db: LimitDb, userId: string, courseId: string, now: Date) {
	return db.transaction(async (tx) => {
		const course = await readCourse(tx, courseId);
		if (!course || course.status !== 'published') return refuse('not_found');
		const member = await lockMember(tx, userId);
		if (!member) return refuse('not_found');
		if (member.status !== 'active') return refuse('blocked');
		const [existing] = await tx
			.select({ id: courseAccess.id, status: courseAccess.status })
			.from(courseAccess)
			.where(and(eq(courseAccess.courseId, courseId), eq(courseAccess.userId, userId)))
			.for('update');
		if (existing && existing.status !== 'rejected') return refuse('bad_state');
		const missing = await missingFor(tx, course, userId, member, now);
		if (missing.length > 0) return { ok: false, reason: 'conditions', missing } as const;
		if (existing) {
			await tx
				.update(courseAccess)
				.set({ status: 'pending', reviewedBy: null, reviewedAt: null, reviewNote: null })
				.where(eq(courseAccess.id, existing.id));
			return { ok: true, id: existing.id, member, course } as const;
		}
		const [row] = await tx
			.insert(courseAccess)
			.values({ courseId, userId })
			.returning({ id: courseAccess.id });
		return { ok: true, id: row.id, member, course } as const;
	});
}

export async function applyForCourse(
	db: LimitDb,
	userId: string,
	courseId: string,
	deps: AccessDeps
): Promise<ApplyResult> {
	if (!isUuid(userId) || !isUuid(courseId)) return refuse('not_found');
	const outcome = await apply(db, userId, courseId, deps.now ?? new Date()).catch((e) => {
		if (isDuplicate(e)) return refuse('bad_state');
		throw e;
	});
	if (!outcome.ok) return outcome;
	const to = await federationEmail(db);
	if (!to) console.warn(`course access ${outcome.id}: no federation email, letter not sent`);
	else {
		const letter = accessRequestLetter(to, outcome.member, outcome.course, deps.siteUrl);
		await deps.send(letter).catch((e) => console.warn(`course access ${outcome.id}: letter`, e));
	}
	return { ok: true, id: outcome.id };
}
