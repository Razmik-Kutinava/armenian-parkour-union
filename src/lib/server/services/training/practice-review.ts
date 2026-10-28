import { eq } from 'drizzle-orm';
import type { PortalText } from '#lib/i18n/localized.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { courses } from '../../db/schema/training';
import { practiceSubmissions, practiceTasks } from '../../db/schema/training-progress';
import { users } from '../../db/schema/users';
import type { Mail } from '../../mail/resend';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';
import { completeCourse } from './course-complete';
import { practiceDecisionLetter } from './practice-mail';
import { accessOf } from './quiz-facts';

/* docs/03 sections 18.4 p. 4–5 and 18.6, docs/05 section 27 "Practice": accept or return (the
 * comment is required) a pending video, never one's own. Row lock, audit in the same transaction,
 * the letters after the commit; an accepted video may finish the course (section 18.5).
 * Decisions — docs/todo.md 9.7 (4), 9.8 (2–3). */

export type ReviewInput = { action: 'approve' | 'reject'; comment: string };
export type ReviewRefusal = 'not_allowed' | 'invalid' | 'not_found' | 'bad_state' | 'own';
export type ReviewResult = { ok: true } | { ok: false; reason: ReviewRefusal };
export type ReviewDeps = {
	send: (mail: Mail) => Promise<void>;
	siteUrl: string | undefined;
	ip: string | null;
	now?: Date;
};

const COMMENT_MAX = 1000;
const STATUS = { approve: 'approved', reject: 'rejected' } as const;
const refuse = (reason: ReviewRefusal) => ({ ok: false, reason }) as const;

async function facts(tx: LimitDb, taskId: string, userId: string) {
	const [row] = await tx
		.select({
			task: practiceTasks.title,
			slug: courses.slug,
			course: courses.title,
			email: users.email,
			locale: users.locale,
			firstName: users.firstName,
			name: users.name
		})
		.from(practiceTasks)
		.innerJoin(courses, eq(courses.id, practiceTasks.courseId))
		.innerJoin(users, eq(users.id, userId))
		.where(eq(practiceTasks.id, taskId));
	return row;
}

export async function reviewPractice(
	db: LimitDb,
	actor: Actor,
	id: string,
	input: ReviewInput,
	deps: ReviewDeps
): Promise<ReviewResult> {
	if (!roleCan(actor.role, 'training.review')) return refuse('not_allowed');
	const note = input.comment.trim() || null;
	if ((input.action === 'reject' && !note) || (note?.length ?? 0) > COMMENT_MAX) {
		return refuse('invalid');
	}
	if (!isUuid(id)) return refuse('not_found');
	const now = deps.now ?? new Date();
	const outcome = await db.transaction(async (tx) => {
		const [owner] = await tx
			.select({ userId: practiceSubmissions.userId, courseId: practiceTasks.courseId })
			.from(practiceSubmissions)
			.innerJoin(practiceTasks, eq(practiceTasks.id, practiceSubmissions.taskId))
			.where(eq(practiceSubmissions.id, id));
		if (!owner) return refuse('not_found');
		/* The member's submit locks the access row before the submission: the same order here. */
		await accessOf(tx, owner.courseId, owner.userId, true);
		const [row] = await tx
			.select()
			.from(practiceSubmissions)
			.where(eq(practiceSubmissions.id, id))
			.for('update');
		if (!row) return refuse('not_found');
		if (row.userId === actor.id) return refuse('own');
		if (row.status !== 'pending') return refuse('bad_state');
		const status = STATUS[input.action];
		await tx
			.update(practiceSubmissions)
			.set({ status, reviewedBy: actor.id, reviewedAt: now, reviewNote: note })
			.where(eq(practiceSubmissions.id, id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: `practice_submission.${input.action}`,
			entityType: 'practice_submission',
			entityId: id,
			before: { status: row.status },
			after: {
				status,
				taskId: row.taskId,
				userId: row.userId,
				...(note ? { reviewNote: note } : {})
			},
			ip: deps.ip
		});
		const f = await facts(tx, row.taskId, row.userId);
		const course = { slug: f.slug, title: f.course as PortalText };
		const letter = practiceDecisionLetter(
			f,
			course,
			f.task as PortalText,
			{ status, note },
			deps.siteUrl
		);
		const finished =
			status === 'approved'
				? await completeCourse(tx, owner.courseId, row.userId, actor.id, { ...deps, now })
				: [];
		return { ok: true, letters: [letter, ...finished] } as const;
	});
	if (!outcome.ok) return outcome;
	for (const letter of outcome.letters) {
		await deps.send(letter).catch((e) => console.warn(`practice ${id}: letter`, e));
	}
	return { ok: true };
}
