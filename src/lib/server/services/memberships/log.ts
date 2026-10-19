import type { LimitDb } from '../../auth/rate-limit';
import type { membershipStatus } from '../../db/schema/enums';
import { writeAudit } from '../audit';

type MembershipStatus = (typeof membershipStatus.enumValues)[number];

/** Automatic changes have no actor (docs/07 section 7 p. 5): payment provider or the daily job. */
export async function logMembershipStatus(
	tx: LimitDb,
	membershipId: string,
	before: MembershipStatus,
	after: MembershipStatus,
	details: Record<string, unknown> = {}
) {
	await writeAudit(tx, {
		actorId: null,
		action: 'membership.status',
		entityType: 'membership',
		entityId: membershipId,
		before: { status: before },
		after: { status: after, ...details }
	});
}
