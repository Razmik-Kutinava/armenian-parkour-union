import {
	and,
	asc,
	count,
	desc,
	eq,
	gt,
	ilike,
	isNotNull,
	isNull,
	lte,
	or,
	type SQL
} from 'drizzle-orm';
import {
	PAGE_SIZE,
	pageOffset,
	type ListOptions,
	type ListState
} from '#lib/components/admin/list-state.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import type { MembershipLevel, UserRole } from '../../auth/session';
import { membershipLevel, userRole, userStatus } from '../../db/schema/enums';
import { users } from '../../db/schema/users';
import type { Actor } from './target';

/** docs/05 section 6. Filter values are checked against these lists before reaching SQL. */
export const userFilterValues = {
	level: membershipLevel.enumValues,
	role: userRole.enumValues,
	status: userStatus.enumValues,
	age: ['minor', 'adult']
} as const;

export const userListOptions: ListOptions = {
	sortable: ['name', 'createdAt', 'points'],
	filters: ['level', 'role', 'status', 'age', 'city'],
	defaultSort: { key: 'createdAt', dir: 'desc' }
};

export type UserListRow = {
	id: string;
	name: string;
	email?: string;
	level: MembershipLevel | null;
	role: UserRole;
	pointsBalance: number;
	status: 'active' | 'blocked';
	createdAt: Date;
};

const sortColumns = { name: users.name, createdAt: users.createdAt, points: users.pointsBalance };
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** `YYYY-MM-DD` of the 18th birthday cut-off: born after it → under 18 today. */
function adultCutoff(today: Date): string {
	const d = new Date(
		Date.UTC(today.getUTCFullYear() - 18, today.getUTCMonth(), today.getUTCDate())
	);
	return d.toISOString().slice(0, 10);
}

function allowed<K extends keyof typeof userFilterValues>(key: K, value: string | undefined) {
	return (userFilterValues[key] as readonly string[]).includes(value ?? '') ? value : undefined;
}

function conditions(viewer: Actor, state: ListState, full: boolean, today: Date): SQL[] {
	const f = state.filters;
	const where: (SQL | undefined)[] = [isNull(users.deletedAt)];
	// docs/04 section 6.5: moderators reach members only
	if (viewer.role !== 'admin') where.push(eq(users.role, 'member'));
	if (state.q) {
		const like = `%${escapeLike(state.q)}%`;
		const byName = [
			ilike(users.name, like),
			ilike(users.firstName, like),
			ilike(users.lastName, like)
		];
		// docs/04 section 4: no search by contacts without the right to see them
		const byContact = full ? [ilike(users.email, like), ilike(users.phone, like)] : [];
		where.push(or(...byName, ...byContact));
	}
	const level = allowed('level', f.level) as MembershipLevel | undefined;
	if (level) where.push(eq(users.level, level));
	const role = allowed('role', f.role) as UserRole | undefined;
	if (role) where.push(eq(users.role, role));
	const status = allowed('status', f.status) as 'active' | 'blocked' | undefined;
	if (status) where.push(eq(users.status, status));
	const age = allowed('age', f.age);
	if (age === 'minor') where.push(gt(users.birthDate, adultCutoff(today)));
	if (age === 'adult') where.push(lte(users.birthDate, adultCutoff(today)));
	if (f.city) where.push(ilike(users.city, escapeLike(f.city)));
	return where.filter((c): c is SQL => !!c);
}

/** Cities for the filter: only values that exist (the filter is a list, not free text). */
export async function listCities(db: LimitDb, viewer: Actor): Promise<string[]> {
	const where = [isNotNull(users.city), isNull(users.deletedAt)];
	if (viewer.role !== 'admin') where.push(eq(users.role, 'member'));
	const rows = await db
		.selectDistinct({ city: users.city })
		.from(users)
		.where(and(...where))
		.orderBy(asc(users.city))
		.limit(200);
	return rows.map((r) => r.city).filter((c): c is string => !!c);
}

export async function listUsers(
	db: LimitDb,
	viewer: Actor,
	state: ListState,
	today = new Date()
): Promise<{ rows: UserListRow[]; total: number }> {
	if (!roleCan(viewer.role, 'users.read_limited')) return { rows: [], total: 0 };
	const full = roleCan(viewer.role, 'users.read_full');
	const where = and(...conditions(viewer, state, full, today));
	const column = sortColumns[state.sort as keyof typeof sortColumns] ?? users.createdAt;
	const order = state.dir === 'asc' ? asc(column) : desc(column);
	const rows = await db
		.select({
			id: users.id,
			name: users.name,
			...(full ? { email: users.email } : {}),
			level: users.level,
			role: users.role,
			pointsBalance: users.pointsBalance,
			status: users.status,
			createdAt: users.createdAt
		})
		.from(users)
		.where(where)
		.orderBy(order, asc(users.id))
		.limit(PAGE_SIZE)
		.offset(pageOffset(state.page));
	const [{ total }] = await db.select({ total: count() }).from(users).where(where);
	return { rows, total };
}
