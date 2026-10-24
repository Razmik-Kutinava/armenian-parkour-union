import { and, count, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';
import {
	PAGE_SIZE,
	pageOffset,
	type ListOptions,
	type ListState
} from '#lib/components/admin/list-state.ts';
import { EXPIRING_DAYS } from '#lib/validation/certificate-enums.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { certificates } from '../../db/schema/certification';
import { users } from '../../db/schema/users';
import type { Actor } from '../users/target';
import { certificateState, type CertificateState } from './validity';

/* docs/05 section 8: the certificate list; filter values are checked before reaching SQL. */

export const certificateListOptions: ListOptions = {
	sortable: ['issuedAt', 'expiresAt'],
	filters: ['kind', 'state', 'expiring'],
	defaultSort: { key: 'issuedAt', dir: 'desc' }
};

export type CertificateListRow = {
	id: string;
	number: string;
	userId: string;
	memberName: string;
	kind: (typeof certificates.$inferSelect)['kind'];
	level: 'advanced' | 'pro' | null;
	category: string | null;
	issuedAt: Date;
	expiresAt: Date | null;
	state: CertificateState;
};

const c = certificates;
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (ch) => `\\${ch}`);

const TYPES: Record<string, SQL | undefined> = {
	level_advanced: and(eq(c.kind, 'level'), eq(c.level, 'advanced')),
	level_pro: and(eq(c.kind, 'level'), eq(c.level, 'pro')),
	trainer: eq(c.kind, 'trainer'),
	judge: eq(c.kind, 'judge')
};

/** The same split as `certificateState`: an `active` row past its expiry is expired. */
function stateIs(state: string | undefined, at: string): SQL | undefined {
	const lapsed = sql`${c.expiresAt} is not null and ${c.expiresAt} <= ${at}::timestamptz`;
	if (state === 'active') return sql`${c.status} = 'active' and not (${lapsed})`;
	if (state === 'expired')
		return sql`(${c.status} = 'expired' or (${c.status} = 'active' and ${lapsed}))`;
	if (state === 'revoked') return eq(c.status, 'revoked');
	return undefined;
}

/** `contacts`: the member email is searched (docs/04 section 4: only with `users.read_full`). */
function conditions(state: ListState, contacts: boolean, now: Date): SQL | undefined {
	const f = state.filters;
	const at = now.toISOString();
	const type = f.kind && Object.hasOwn(TYPES, f.kind) ? TYPES[f.kind] : undefined;
	const where: (SQL | undefined)[] = [isNull(users.deletedAt), type, stateIs(f.state, at)];
	if (state.q) {
		const like = `%${escapeLike(state.q)}%`;
		where.push(
			or(
				ilike(users.name, like),
				ilike(c.number, like),
				contacts ? ilike(users.email, like) : undefined
			)
		);
	}
	if (f.expiring === String(EXPIRING_DAYS)) {
		where.push(
			sql`${c.status} = 'active' and ${c.expiresAt} > ${at}::timestamptz
				and ${c.expiresAt} <= ${at}::timestamptz + make_interval(days => ${EXPIRING_DAYS})`
		);
	}
	return and(...where);
}

export async function listCertificates(
	db: LimitDb,
	viewer: Actor,
	state: ListState,
	now = new Date()
): Promise<{ rows: CertificateListRow[]; total: number }> {
	if (!roleCan(viewer.role, 'certificates.read')) return { rows: [], total: 0 };
	const where = conditions(state, roleCan(viewer.role, 'users.read_full'), now);
	const column = state.sort === 'expiresAt' ? c.expiresAt : c.issuedAt;
	const order =
		state.dir === 'asc' ? sql`${column} asc nulls last` : sql`${column} desc nulls last`;
	const rows = await db
		.select({
			id: c.id,
			number: c.number,
			userId: c.userId,
			memberName: users.name,
			kind: c.kind,
			level: c.level,
			category: c.category,
			issuedAt: c.issuedAt,
			expiresAt: c.expiresAt,
			status: c.status
		})
		.from(c)
		.innerJoin(users, eq(users.id, c.userId))
		.where(where)
		.orderBy(order, sql`${c.createdAt} desc`, c.id)
		.limit(PAGE_SIZE)
		.offset(pageOffset(state.page));
	const [{ total }] = await db
		.select({ total: count() })
		.from(c)
		.innerJoin(users, eq(users.id, c.userId))
		.where(where);
	return {
		rows: rows.map(({ status, ...r }) => ({
			...r,
			level: r.level === 'novice' ? null : r.level,
			state: certificateState({ status, expiresAt: r.expiresAt }, now)
		})),
		total
	};
}
