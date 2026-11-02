import { eq } from 'drizzle-orm';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { users } from '../../db/schema/users';
import { volunteerReports } from '../../db/schema/volunteer-requests';
import type { Mail } from '../../mail/resend';
import { writeAudit } from '../audit';
import { awardPoints } from '../points/award';
import { isUuid, type Actor } from '../users/target';
import { reportDecisionLetter } from './report-mail';

/* docs/03 section 19.7 p. 3, 19.9: approve awards volunteer_report once; reject needs a note;
 * never one's own; shown url/fileKey must still match (member may replace meanwhile). */

export type ReportReviewInput = {
	action: 'approve' | 'reject';
	comment: string;
	shown: string;
};

export type ReportReviewRefusal =
	'not_allowed' | 'invalid' | 'not_found' | 'bad_state' | 'own' | 'changed';

export type ReportReviewResult = { ok: true } | { ok: false; reason: ReportReviewRefusal };

export type ReportReviewDeps = {
	send: (mail: Mail) => Promise<void>;
	siteUrl: string | undefined;
	ip: string | null;
	now?: Date;
};

const COMMENT_MAX = 1000;
const STATUS = { approve: 'approved', reject: 'rejected' } as const;
const refuse = (reason: ReportReviewRefusal) => ({ ok: false, reason }) as const;

export async function reviewReport(
	db: LimitDb,
	actor: Actor,
	id: string,
	input: ReportReviewInput,
	deps: ReportReviewDeps
): Promise<ReportReviewResult> {
	if (!roleCan(actor.role, 'volunteer.manage')) return refuse('not_allowed');
	const note = input.comment.trim() || null;
	if ((input.action === 'reject' && !note) || (note?.length ?? 0) > COMMENT_MAX) {
		return refuse('invalid');
	}
	if (!isUuid(id)) return refuse('not_found');
	const now = deps.now ?? new Date();
	const outcome = await db.transaction(async (tx) => {
		const [row] = await tx
			.select()
			.from(volunteerReports)
			.where(eq(volunteerReports.id, id))
			.for('update');
		if (!row) return refuse('not_found');
		if (row.userId === actor.id) return refuse('own');
		if (row.status !== 'pending') return refuse('bad_state');
		const current = row.url ?? row.fileKey ?? '';
		if (current !== input.shown) return refuse('changed');
		const status = STATUS[input.action];
		await tx
			.update(volunteerReports)
			.set({ status, reviewedBy: actor.id, reviewedAt: now, reviewNote: note })
			.where(eq(volunteerReports.id, id));
		let points = 0;
		if (input.action === 'approve') {
			const award = await awardPoints(tx, {
				rule: 'volunteer_report',
				userId: row.userId,
				sourceId: id
			});
			points = award.status === 'awarded' ? award.points : 0;
		}
		await writeAudit(tx, {
			actorId: actor.id,
			action: `volunteer_report.${input.action}`,
			entityType: 'volunteer_report',
			entityId: id,
			before: { status: row.status },
			after: {
				status,
				userId: row.userId,
				...(input.action === 'approve' ? { points } : note ? { reviewNote: note } : {})
			},
			ip: deps.ip
		});
		const [member] = await tx
			.select({
				email: users.email,
				locale: users.locale,
				firstName: users.firstName,
				name: users.name
			})
			.from(users)
			.where(eq(users.id, row.userId));
		const letter = member
			? reportDecisionLetter(
					member,
					input.action === 'approve'
						? { status: 'approved', points }
						: { status: 'rejected', reason: note! },
					deps.siteUrl
				)
			: null;
		return { ok: true as const, letter };
	});
	if (!outcome.ok) return outcome;
	if (outcome.letter) {
		await deps.send(outcome.letter).catch((e) => console.warn(`report ${id}: letter`, e));
	}
	return { ok: true };
}
