import { and, asc, desc, eq, ilike, inArray, isNull, max, or } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import type { UserRole } from '../../auth/session';
import { session } from '../../db/schema/auth';
import { users } from '../../db/schema/users';

export type StaffRow = {
	id: string;
	name: string;
	role: UserRole;
	status: 'active' | 'blocked';
	lastLoginAt: Date | null;
};

/** docs/05 section 23. "Last sign-in" is the newest session (decision 2026-10-07). */
export async function listStaff(db: LimitDb): Promise<StaffRow[]> {
	return db
		.select({
			id: users.id,
			name: users.name,
			role: users.role,
			status: users.status,
			lastLoginAt: max(session.createdAt)
		})
		.from(users)
		.leftJoin(session, eq(session.userId, users.id))
		.where(and(inArray(users.role, ['editor', 'moderator', 'admin']), isNull(users.deletedAt)))
		.groupBy(users.id)
		.orderBy(desc(users.role), asc(users.name));
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Active members to give a role to, by name or email. */
export async function findMembers(db: LimitDb, query: string, limit = 10) {
	const q = query.trim().slice(0, 200);
	if (!q) return [];
	const like = `%${escapeLike(q)}%`;
	return db
		.select({ id: users.id, name: users.name, email: users.email })
		.from(users)
		.where(
			and(
				eq(users.role, 'member'),
				eq(users.status, 'active'),
				isNull(users.deletedAt),
				or(ilike(users.name, like), ilike(users.lastName, like), ilike(users.email, like))
			)
		)
		.orderBy(asc(users.name))
		.limit(limit);
}
