import { and, eq, isNull } from 'drizzle-orm';
import { ageOn } from '#lib/validation/auth.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import type { MembershipLevel, UserRole } from '../../auth/session';
import { canManageUser } from '../../auth/role-rules';
import { users } from '../../db/schema/users';
import { isUuid, type Actor } from './target';

export type UserCard = {
	id: string;
	name: string;
	firstName: string | null;
	lastName: string | null;
	role: UserRole;
	status: 'active' | 'blocked';
	level: MembershipLevel | null;
	pointsBalance: number;
	emailVerified: boolean;
	city: string | null;
	age: number | null;
	guardianName: string | null;
	guardianPhone: string | null;
	guardianEmail: string | null;
	createdAt: Date;
	/* only with users.read_full (docs/04 section 4) */
	email?: string;
	phone?: string | null;
	birthDate?: string | null;
};

/** Card of one user; null when it does not exist or the viewer may not reach it (→ 404). */
export async function getUserCard(
	db: LimitDb,
	viewer: Actor,
	id: string,
	today = new Date()
): Promise<UserCard | null> {
	if (!isUuid(id) || !roleCan(viewer.role, 'users.read_limited')) return null;
	const [row] = await db
		.select()
		.from(users)
		.where(and(eq(users.id, id), isNull(users.deletedAt)));
	if (!row || !canManageUser(viewer, row.role)) return null;
	const card: UserCard = {
		id: row.id,
		name: row.name,
		firstName: row.firstName,
		lastName: row.lastName,
		role: row.role,
		status: row.status,
		level: row.level,
		pointsBalance: row.pointsBalance,
		emailVerified: row.emailVerified,
		city: row.city,
		age: row.birthDate ? ageOn(row.birthDate, today) : null,
		guardianName: row.guardianName,
		guardianPhone: row.guardianPhone,
		guardianEmail: row.guardianEmail,
		createdAt: row.createdAt
	};
	if (!roleCan(viewer.role, 'users.read_full')) return card;
	return { ...card, email: row.email, phone: row.phone, birthDate: row.birthDate };
}
