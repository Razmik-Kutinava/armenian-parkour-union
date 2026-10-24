import { and, eq, isNull } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { certificates } from '../../db/schema/certification';
import { users } from '../../db/schema/users';
import { holderName } from './pdf-content';
import { certificateState, type CertificateState } from './validity';

/* docs/06 section 4.10: what anyone with the QR link may see. Contacts, the birth date and the
 * revoke reason are not even selected — `load` cannot leak what it never had. */

export type PublicCertificate = {
	holder: string;
	kind: 'level' | 'trainer' | 'judge';
	level: 'novice' | 'advanced' | 'pro' | null;
	category: string | null;
	number: string;
	issuedAt: Date;
	expiresAt: Date | null;
	state: CertificateState;
};

/** `newPublicToken` is base64url; anything else cannot be ours. */
const TOKEN = /^[A-Za-z0-9_-]{1,64}$/;

/** A deleted account is not shown publicly: the same as no certificate. */
export async function findPublicCertificate(
	db: LimitDb,
	token: string,
	now = new Date()
): Promise<PublicCertificate | null> {
	if (!TOKEN.test(token)) return null;
	const [row] = await db
		.select({
			kind: certificates.kind,
			level: certificates.level,
			category: certificates.category,
			number: certificates.number,
			status: certificates.status,
			issuedAt: certificates.issuedAt,
			expiresAt: certificates.expiresAt,
			name: users.name,
			firstName: users.firstName,
			lastName: users.lastName
		})
		.from(certificates)
		.innerJoin(users, eq(users.id, certificates.userId))
		.where(and(eq(certificates.publicToken, token), isNull(users.deletedAt)));
	if (!row) return null;
	return {
		holder: holderName(row),
		kind: row.kind,
		level: row.level,
		category: row.category,
		number: row.number,
		issuedAt: row.issuedAt,
		expiresAt: row.expiresAt,
		state: certificateState(row, now)
	};
}
