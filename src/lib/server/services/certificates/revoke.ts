import { eq } from 'drizzle-orm';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { certificates } from '../../db/schema/certification';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';
import { CERTIFICATE_COMMENT_MAX } from './issue-input';

/* docs/03 section 4.7: only an admin, with a reason. The level and the points stay — the admin
 * changes them separately (manual points correction, manual level change); a coach or judge
 * profile is switched off by 6.6. */

export type RevokeInput = { certificateId: string; reason: string };
export type RevokeOutcome = 'ok' | 'not_allowed' | 'invalid' | 'not_found' | 'already_revoked';

export async function revokeCertificate(
	db: LimitDb,
	actor: Actor,
	input: RevokeInput,
	ip: string | null,
	now = new Date()
): Promise<RevokeOutcome> {
	if (!roleCan(actor.role, 'certificates.revoke')) return 'not_allowed';
	const reason = input.reason?.trim();
	if (!reason || reason.length > CERTIFICATE_COMMENT_MAX) return 'invalid';
	if (!isUuid(input.certificateId)) return 'not_found';
	return db.transaction(async (tx) => {
		const [row] = await tx
			.select()
			.from(certificates)
			.where(eq(certificates.id, input.certificateId))
			.for('update');
		if (!row) return 'not_found';
		if (row.status === 'revoked') return 'already_revoked';
		await tx
			.update(certificates)
			.set({ status: 'revoked', revokedAt: now, revokeReason: reason })
			.where(eq(certificates.id, row.id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'certificate.revoke',
			entityType: 'certificate',
			entityId: row.id,
			before: { status: row.status },
			after: {
				status: 'revoked',
				reason,
				userId: row.userId,
				kind: row.kind,
				level: row.level,
				number: row.number
			},
			ip
		});
		return 'ok';
	});
}
