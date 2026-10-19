import { and, desc, eq } from 'drizzle-orm';
import { isMinor } from '#lib/validation/auth.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { payments } from '../../db/schema/payments';
import { users } from '../../db/schema/users';

/** `name: null` — shown as "Anonymous". No email here on purpose (docs/04 section 5.4). */
export type PublicDonation = {
	name: string | null;
	amountMinor: number;
	currency: string;
	paidAt: Date;
};

type Row = {
	isAnonymous: boolean;
	donorName: string | null;
	userId: string | null;
	userName: string | null;
	birthDate: string | null;
	deletedAt: Date | null;
};

/** A member is named only as a known adult who still has an account (docs/03 section 13). */
function publicName(row: Row, today: Date): string | null {
	if (row.isAnonymous) return null;
	if (!row.userId) return row.donorName?.trim() || null;
	if (!row.userName || row.deletedAt || !row.birthDate || isMinor(row.birthDate, today))
		return null;
	return row.userName;
}

/** docs/06 section 4.8: the latest paid donations — name and amount. */
export async function recentDonations(
	db: LimitDb,
	limit = 10,
	today = new Date()
): Promise<PublicDonation[]> {
	const rows = await db
		.select({
			isAnonymous: payments.isAnonymous,
			donorName: payments.donorName,
			userId: payments.userId,
			userName: users.name,
			birthDate: users.birthDate,
			deletedAt: users.deletedAt,
			amountMinor: payments.amountMinor,
			currency: payments.currency,
			paidAt: payments.paidAt
		})
		.from(payments)
		.leftJoin(users, eq(users.id, payments.userId))
		.where(and(eq(payments.kind, 'donation'), eq(payments.status, 'paid')))
		.orderBy(desc(payments.paidAt))
		.limit(limit);
	return rows.map((row) => ({
		name: publicName(row, today),
		amountMinor: row.amountMinor,
		currency: row.currency,
		paidAt: row.paidAt ?? new Date(0)
	}));
}
