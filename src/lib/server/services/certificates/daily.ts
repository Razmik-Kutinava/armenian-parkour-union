import { and, eq, inArray, lte } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { certificates } from '../../db/schema/certification';
import { writeAudit } from '../audit';
import { deactivateLapsedStaff } from '../staff/profile';
import { sendExpiryReminders } from './daily-reminders';
import type { CertificateLetterDeps } from './mail';

/* docs/03 section 4.6, 5.3: coach and judge certificates end on `expires_at`, their profiles go
 * off; letters before the end — `site_settings.certificates.staff_remind_days`. */

export type CertificateDailyDeps = CertificateLetterDeps & {
	remindDays: readonly number[];
	now?: Date;
};
export type CertificateDailySummary = { expired: number; deactivated: number; reminded: number };

/** Only the status: `certificateState` already reads an ended one as `expired`. */
async function expireEnded(db: LimitDb, now: Date): Promise<number> {
	return db.transaction(async (tx) => {
		const rows = await tx
			.update(certificates)
			.set({ status: 'expired' })
			.where(
				and(
					eq(certificates.status, 'active'),
					inArray(certificates.kind, ['trainer', 'judge']),
					lte(certificates.expiresAt, now)
				)
			)
			.returning({ id: certificates.id, userId: certificates.userId, kind: certificates.kind });
		for (const row of rows)
			await writeAudit(tx, {
				actorId: null,
				action: 'certificate.expire',
				entityType: 'certificate',
				entityId: row.id,
				before: { status: 'active' },
				after: { status: 'expired', userId: row.userId, kind: row.kind },
				ip: null
			});
		return rows.length;
	});
}

/** Once a day (`POST /api/cron/certificates`); safe to run again. */
export async function runCertificateDaily(
	db: LimitDb,
	deps: CertificateDailyDeps
): Promise<CertificateDailySummary> {
	const now = deps.now ?? new Date();
	const expired = await expireEnded(db, now);
	const deactivated = await deactivateLapsedStaff(db, now);
	const reminded = await sendExpiryReminders(db, now, deps.remindDays, deps);
	return { expired, deactivated, reminded };
}
