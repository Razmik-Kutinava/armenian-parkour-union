import { sql } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { consents } from '../../db/schema/consents';

/* Test support only. */

export const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
export const PDF = new TextEncoder().encode('%PDF-1.7\n%âãÏÓ\n');

/** Born `years` ago on January 1st: a minor below 18. */
export const bornYearsAgo = (years: number, now = new Date()) =>
	`${now.getUTCFullYear() - years}-01-01`;

export const daysFromNow = (days: number, now = new Date()) =>
	new Date(now.getTime() + days * 86_400_000);

export async function insertConsent(
	tx: LimitDb,
	userId: string,
	values: Partial<typeof consents.$inferInsert> = {}
) {
	const [row] = await tx
		.insert(consents)
		.values({
			userId,
			kind: 'parental',
			fileKey: `consents/${userId}/${crypto.randomUUID()}.png`,
			signedAt: new Date('2026-10-01T00:00:00+04:00'),
			/* one test transaction: rows keep the order they were written in */
			createdAt: sql`clock_timestamp()`,
			...values
		})
		.returning();
	return row;
}
