import { eq } from 'drizzle-orm';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { examApplications } from '../../db/schema/certification';
import { users } from '../../db/schema/users';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';
import type { ApplyExamDeps } from './apply';
import { applicationRejectLetter } from './application-mail';

/* Reject a pending application (docs/todo.md). Approve happens in scheduleExam. */

export const APPLICATION_REASON_MAX = 1000;

export type RejectResult =
	{ ok: true } | { ok: false; reason: 'not_allowed' | 'invalid' | 'not_found' | 'bad_state' };

const refuse = (reason: 'not_allowed' | 'invalid' | 'not_found' | 'bad_state') =>
	({ ok: false, reason }) as const;

export async function rejectExamApplication(
	db: LimitDb,
	actor: Actor,
	id: string,
	input: { reason: string },
	deps: Pick<ApplyExamDeps, 'send' | 'siteUrl' | 'ip'>,
	now = new Date()
): Promise<RejectResult> {
	if (!roleCan(actor.role, 'exams.manage')) return refuse('not_allowed');
	const note = input.reason.trim();
	if (!note || note.length > APPLICATION_REASON_MAX) return refuse('invalid');
	if (!isUuid(id)) return refuse('not_found');

	const outcome = await db.transaction(async (tx) => {
		const [row] = await tx
			.select()
			.from(examApplications)
			.where(eq(examApplications.id, id))
			.for('update');
		if (!row) return refuse('not_found');
		if (row.status !== 'pending') return refuse('bad_state');
		const [member] = await tx
			.select({
				email: users.email,
				locale: users.locale,
				firstName: users.firstName,
				lastName: users.lastName,
				name: users.name
			})
			.from(users)
			.where(eq(users.id, row.userId));
		if (!member) return refuse('not_found');
		await tx
			.update(examApplications)
			.set({
				status: 'rejected',
				reviewNote: note,
				reviewedBy: actor.id,
				reviewedAt: now
			})
			.where(eq(examApplications.id, id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'exam_application.reject',
			entityType: 'exam_application',
			entityId: id,
			before: { status: 'pending' },
			after: { status: 'rejected', reviewNote: note, userId: row.userId },
			ip: deps.ip
		});
		return {
			ok: true as const,
			letter: applicationRejectLetter(member, row.kind, note, deps.siteUrl)
		};
	});
	if (!outcome.ok) return outcome;
	await deps.send(outcome.letter).catch((e) => console.warn(`exam application ${id}: letter`, e));
	return { ok: true };
}
