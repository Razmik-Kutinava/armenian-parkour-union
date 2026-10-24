import type { certificates } from '../../db/schema/certification';

/* docs/03 section 4.6–4.7: level certificates never expire; a coach or judge one ends on
 * `expires_at` even before the daily job (6.9) writes `expired`. */

type Certificate = typeof certificates.$inferSelect;
export type CertificateState = Certificate['status'];

export function certificateState(
	cert: Pick<Certificate, 'status' | 'expiresAt'>,
	now = new Date()
): CertificateState {
	if (cert.status !== 'active') return cert.status;
	return cert.expiresAt && cert.expiresAt <= now ? 'expired' : 'active';
}

/** `months` later; a day the target month lacks becomes its last day (31 Jan + 1 → 28 Feb). */
export function staffExpiry(issuedAt: Date, months: number): Date {
	const end = new Date(issuedAt);
	end.setUTCDate(1);
	end.setUTCMonth(end.getUTCMonth() + months);
	const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
	end.setUTCDate(Math.min(issuedAt.getUTCDate(), last));
	return end;
}
