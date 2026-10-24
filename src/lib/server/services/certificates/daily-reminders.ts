import { and, eq, gt, inArray, isNull, lte, notExists, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { LimitDb } from '../../auth/rate-limit';
import { certificates } from '../../db/schema/certification';
import { users } from '../../db/schema/users';
import { expiryLetter, sendCertificateLetter, type CertificateLetterDeps } from './mail';

const DAY_MS = 86_400_000;
const later = alias(certificates, 'later_certificate');

/** Live coach and judge certificates ending within `horizon`, of active holders, not yet renewed. */
function dueCertificates(db: LimitDb, now: Date, horizon: Date) {
	const renewed = db
		.select({ id: later.id })
		.from(later)
		.where(
			and(
				eq(later.userId, certificates.userId),
				eq(later.kind, certificates.kind),
				eq(later.status, 'active'),
				or(isNull(later.expiresAt), gt(later.expiresAt, certificates.expiresAt))
			)
		);
	return db
		.select({
			id: certificates.id,
			kind: certificates.kind,
			number: certificates.number,
			expiresAt: certificates.expiresAt,
			remindedDays: certificates.remindedDays,
			email: users.email,
			locale: users.locale,
			firstName: users.firstName,
			name: users.name
		})
		.from(certificates)
		.innerJoin(users, eq(users.id, certificates.userId))
		.where(
			and(
				eq(certificates.status, 'active'),
				inArray(certificates.kind, ['trainer', 'judge']),
				gt(certificates.expiresAt, now),
				lte(certificates.expiresAt, horizon),
				eq(users.status, 'active'),
				isNull(users.deletedAt),
				notExists(renewed)
			)
		);
}

/**
 * The closest window that covers the end is the one due, so a short term gets one letter. The mark
 * is set before sending: a rerun never writes twice (a failed send is only logged).
 */
export async function sendExpiryReminders(
	db: LimitDb,
	now: Date,
	days: readonly number[],
	deps: CertificateLetterDeps
): Promise<number> {
	const windows = [...new Set(days)].sort((a, b) => a - b);
	if (!windows.length) return 0;
	const at = (d: number) => new Date(now.getTime() + d * DAY_MS);
	let sent = 0;
	for (const row of await dueCertificates(db, now, at(windows[windows.length - 1]))) {
		const window = windows.find((d) => row.expiresAt! <= at(d))!;
		if (row.remindedDays !== null && row.remindedDays <= window) continue;
		const [claimed] = await db
			.update(certificates)
			.set({ remindedDays: window })
			.where(
				and(
					eq(certificates.id, row.id),
					or(isNull(certificates.remindedDays), gt(certificates.remindedDays, window))
				)
			)
			.returning({ id: certificates.id });
		if (!claimed) continue;
		sent += 1;
		const cert = { kind: row.kind, level: null, number: row.number, expiresAt: row.expiresAt! };
		await sendCertificateLetter(deps.send, expiryLetter(row, cert, deps.siteUrl));
	}
	return sent;
}
