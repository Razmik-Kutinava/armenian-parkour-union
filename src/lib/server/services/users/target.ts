import { and, asc, eq, isNull } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import type { UserRole } from '../../auth/session';
import { users } from '../../db/schema/users';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids come from the URL or a form: anything else is "not found", not a database error. */
export const isUuid = (id: string) => UUID.test(id);

export type Actor = { id: string; role: UserRole };

/**
 * Locks the rows of all active admins (in id order, so two changes wait for each other instead of
 * deadlocking) and returns their number: docs/04 section 6.3 is checked on fresh data.
 */
export async function lockActiveAdmins(tx: LimitDb): Promise<number> {
	const rows = await tx
		.select({ id: users.id })
		.from(users)
		.where(and(eq(users.role, 'admin'), eq(users.status, 'active'), isNull(users.deletedAt)))
		.orderBy(asc(users.id))
		.for('update');
	return rows.length;
}

/** The target account, locked for the change; deleted accounts are not found. */
export async function lockTarget(tx: LimitDb, id: string) {
	if (!isUuid(id)) return null;
	const [row] = await tx
		.select({
			id: users.id,
			role: users.role,
			status: users.status,
			emailVerified: users.emailVerified
		})
		.from(users)
		.where(and(eq(users.id, id), isNull(users.deletedAt)))
		.for('update');
	return row ?? null;
}
