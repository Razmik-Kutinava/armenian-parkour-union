import { and, eq } from 'drizzle-orm';
import { account } from '../db/schema/auth';
import type { LimitDb } from './rate-limit';

/** A user created by an admin has no password yet: the reset mail then says "set a password". */
export async function hasPassword(db: LimitDb, userId: string): Promise<boolean> {
	const rows = await db
		.select({ id: account.id })
		.from(account)
		.where(and(eq(account.userId, userId), eq(account.providerId, 'credential')))
		.limit(1);
	return rows.length > 0;
}
