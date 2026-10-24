import { randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { certificates } from '../../db/schema/certification';

/* docs/03 section 4.4: `APU-{year}-{0001}`, unique and never reused — revoked rows stay, so their
 * numbers stay taken. One issue at a time takes the next number (advisory lock till the commit);
 * unique(`number`) is the last guard. */

export const certificateYear = (issuedAt: Date) =>
	Number(issuedAt.toLocaleString('en-US', { year: 'numeric', timeZone: 'Asia/Yerevan' }));

export const formatCertificateNumber = (year: number, sequence: number) =>
	`APU-${year}-${String(sequence).padStart(4, '0')}`;

/** For the verification link `/certificate/{token}`: 24 random bytes, not guessable. */
export const newPublicToken = () => randomBytes(24).toString('base64url');

export async function nextCertificateNumber(tx: LimitDb, issuedAt: Date): Promise<string> {
	const year = certificateYear(issuedAt);
	await tx.execute(sql`select pg_advisory_xact_lock(hashtext('certificate_number'))`);
	const [row] = await tx
		.select({ last: sql<number | null>`max(split_part(${certificates.number}, '-', 3)::int)` })
		.from(certificates)
		.where(sql`${certificates.number} ~ ${`^APU-${year}-[0-9]+$`}`);
	return formatCertificateNumber(year, Number(row?.last ?? 0) + 1);
}
