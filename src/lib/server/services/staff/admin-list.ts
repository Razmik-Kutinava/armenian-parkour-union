import { and, count, desc, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';
import {
	PAGE_SIZE,
	pageOffset,
	type ListOptions,
	type ListState
} from '#lib/components/admin/list-state.ts';
import { STAFF_KINDS } from '#lib/validation/staff-enums.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { certificates, staffProfiles } from '../../db/schema/certification';
import { users } from '../../db/schema/users';
import type { Actor } from '../users/target';
import { liveCertificateOf, type StaffKind } from './profile';

/* docs/05 section 9: the coach and judge list; filter values are checked before reaching SQL.
 * Viewing is `certificates.read` (docs/04 section 3: moderator and admin; no code of its own). */

export const staffListOptions: ListOptions = {
	sortable: ['member'],
	filters: ['kind', 'active', 'public'],
	defaultSort: { key: 'member', dir: 'asc' }
};

export type StaffListRow = {
	id: string;
	userId: string;
	memberName: string;
	kind: StaffKind;
	category: string | null;
	licenseNumber: string | null;
	certificateId: string | null;
	certificateNumber: string | null;
	isPublic: boolean;
	isActive: boolean;
};

const p = staffProfiles;
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (ch) => `\\${ch}`);
const flag = (value: string | undefined) =>
	value === 'yes' ? true : value === 'no' ? false : undefined;

/** `contacts`: the member email is searched (docs/04 section 4: only with `users.read_full`). */
function conditions(state: ListState, contacts: boolean): SQL | undefined {
	const f = state.filters;
	const kind = STAFF_KINDS.find((k) => k === f.kind);
	const active = flag(f.active);
	const shown = flag(f.public);
	const where: (SQL | undefined)[] = [
		isNull(users.deletedAt),
		kind && eq(p.kind, kind),
		active === undefined ? undefined : eq(p.isActive, active),
		shown === undefined ? undefined : eq(p.isPublic, shown)
	];
	if (state.q) {
		const like = `%${escapeLike(state.q)}%`;
		where.push(
			or(
				ilike(users.name, like),
				ilike(p.licenseNumber, like),
				contacts ? ilike(users.email, like) : undefined
			)
		);
	}
	return and(...where);
}

export async function listStaffProfiles(
	db: LimitDb,
	viewer: Actor,
	state: ListState,
	now = new Date()
): Promise<{ rows: StaffListRow[]; total: number }> {
	if (!roleCan(viewer.role, 'certificates.read')) return { rows: [], total: 0 };
	const where = conditions(state, roleCan(viewer.role, 'users.read_full'));
	/* The newest live certificate of the profile's kind. */
	const live = (column: typeof certificates.id | typeof certificates.number) =>
		sql<string | null>`(${db
			.select({ value: column })
			.from(certificates)
			.where(liveCertificateOf(p.userId, p.kind, now))
			.orderBy(desc(certificates.issuedAt))
			.limit(1)})`;
	const order = state.dir === 'asc' ? sql`${users.name} asc` : sql`${users.name} desc`;
	const rows = await db
		.select({
			id: p.id,
			userId: p.userId,
			memberName: users.name,
			kind: p.kind,
			category: p.category,
			licenseNumber: p.licenseNumber,
			certificateId: live(certificates.id),
			certificateNumber: live(certificates.number),
			isPublic: p.isPublic,
			isActive: p.isActive
		})
		.from(p)
		.innerJoin(users, eq(users.id, p.userId))
		.where(where)
		.orderBy(order, p.kind, p.id)
		.limit(PAGE_SIZE)
		.offset(pageOffset(state.page));
	const [{ total }] = await db
		.select({ total: count() })
		.from(p)
		.innerJoin(users, eq(users.id, p.userId))
		.where(where);
	return { rows, total };
}
