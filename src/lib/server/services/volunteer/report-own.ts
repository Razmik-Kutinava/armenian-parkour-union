import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { pointsLedger } from '../../db/schema/points';
import { volunteerInvitations, volunteerReports } from '../../db/schema/volunteer-requests';
import { isUuid } from '../users/target';

/* docs/06 section 5.12: report status on attended invites; overview — a returned report. */

export type OwnReport = {
	id: string;
	status: 'pending' | 'approved' | 'rejected';
	reviewNote: string | null;
	/** Sum of ledger deltas for this report; null when none. */
	points: number | null;
};

/** Latest report per invitation for this member. */
export async function ownReportsByInvite(
	db: LimitDb,
	userId: string,
	invitationIds: string[]
): Promise<Map<string, OwnReport>> {
	const map = new Map<string, OwnReport>();
	if (!isUuid(userId)) return map;
	const ids = invitationIds.filter(isUuid);
	if (ids.length === 0) return map;
	const rows = await db
		.select({
			id: volunteerReports.id,
			invitationId: volunteerReports.invitationId,
			status: volunteerReports.status,
			reviewNote: volunteerReports.reviewNote
		})
		.from(volunteerReports)
		.where(and(eq(volunteerReports.userId, userId), inArray(volunteerReports.invitationId, ids)))
		.orderBy(desc(volunteerReports.createdAt), desc(volunteerReports.id));
	const reportIds: string[] = [];
	for (const r of rows) {
		if (map.has(r.invitationId)) continue;
		map.set(r.invitationId, {
			id: r.id,
			status: r.status,
			reviewNote: r.reviewNote,
			points: null
		});
		reportIds.push(r.id);
	}
	if (reportIds.length === 0) return map;
	const sums = await db
		.select({
			sourceId: pointsLedger.sourceId,
			points: sql<number>`sum(${pointsLedger.delta})::int`
		})
		.from(pointsLedger)
		.where(
			and(
				eq(pointsLedger.sourceType, 'volunteer_report'),
				inArray(pointsLedger.sourceId, reportIds)
			)
		)
		.groupBy(pointsLedger.sourceId);
	const byId = new Map(sums.map((s) => [s.sourceId, s.points]));
	for (const [inviteId, report] of map) {
		const points = byId.get(report.id);
		if (points != null) map.set(inviteId, { ...report, points });
	}
	return map;
}

/** docs/06 section 5.12 overview: returned report with no live replacement. */
export async function hasReturnedReport(db: LimitDb, userId: string): Promise<boolean> {
	if (!isUuid(userId)) return false;
	const [row] = await db
		.select({ id: volunteerReports.id })
		.from(volunteerReports)
		.innerJoin(volunteerInvitations, eq(volunteerInvitations.id, volunteerReports.invitationId))
		.where(
			and(
				eq(volunteerReports.userId, userId),
				eq(volunteerInvitations.status, 'attended'),
				eq(volunteerReports.status, 'rejected'),
				sql`not exists (
					select 1 from volunteer_reports live
					where live.invitation_id = volunteer_reports.invitation_id
						and live.status in ('pending', 'approved'))`
			)
		)
		.limit(1);
	return Boolean(row);
}
