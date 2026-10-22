import { and, asc, count, desc, eq, gt, ilike, isNull, lte, or, type SQL } from 'drizzle-orm';
import {
	PAGE_SIZE,
	pageOffset,
	type ListOptions,
	type ListState
} from '#lib/components/admin/list-state.ts';
import type { ConsentKind } from '#lib/validation/consents.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { consents } from '../../db/schema/consents';
import { consentKind } from '../../db/schema/enums';
import { users } from '../../db/schema/users';
import type { ConsentView } from './own';
import { inForce, statusView } from './valid';

export { getConsentCard, type ConsentCard } from './card';

/* docs/05 section 10: the list; filter values are checked before reaching SQL. */

export const consentListOptions: ListOptions = {
	sortable: ['createdAt', 'validUntil'],
	filters: ['kind', 'status', 'expiring'],
	defaultSort: { key: 'createdAt', dir: 'desc' }
};

const SOON_DAYS = 30;
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export type ConsentListRow = {
	id: string;
	userId: string;
	memberName: string;
	kind: ConsentKind;
	status: ConsentView;
	signedAt: Date | null;
	validUntil: Date | null;
	createdAt: Date;
};

function byStatus(status: string | undefined, now: Date): SQL | undefined {
	if (status === 'pending' || status === 'rejected') return eq(consents.status, status);
	if (status === 'approved') return inForce(now);
	if (status === 'expired') {
		return or(
			eq(consents.status, 'expired'),
			and(eq(consents.status, 'approved'), lte(consents.validUntil, now))
		);
	}
	return undefined;
}

function conditions(state: ListState, now: Date): SQL | undefined {
	const f = state.filters;
	const where: (SQL | undefined)[] = [isNull(users.deletedAt)];
	if (state.q) where.push(ilike(users.name, `%${escapeLike(state.q)}%`));
	if (consentKind.enumValues.includes(f.kind as ConsentKind)) {
		where.push(eq(consents.kind, f.kind as ConsentKind));
	}
	where.push(byStatus(f.status, now));
	if (f.expiring === '1') {
		const soon = new Date(now.getTime() + SOON_DAYS * 86_400_000);
		where.push(
			eq(consents.status, 'approved'),
			gt(consents.validUntil, now),
			lte(consents.validUntil, soon)
		);
	}
	return and(...where);
}

export async function listConsents(
	db: LimitDb,
	state: ListState,
	now = new Date()
): Promise<{ rows: ConsentListRow[]; total: number }> {
	const where = conditions(state, now);
	const column = state.sort === 'validUntil' ? consents.validUntil : consents.createdAt;
	const rows = await db
		.select({
			id: consents.id,
			userId: consents.userId,
			memberName: users.name,
			kind: consents.kind,
			status: consents.status,
			signedAt: consents.signedAt,
			validUntil: consents.validUntil,
			createdAt: consents.createdAt
		})
		.from(consents)
		.innerJoin(users, eq(users.id, consents.userId))
		.where(where)
		.orderBy(state.dir === 'asc' ? asc(column) : desc(column), desc(consents.id))
		.limit(PAGE_SIZE)
		.offset(pageOffset(state.page));
	const [{ total }] = await db
		.select({ total: count() })
		.from(consents)
		.innerJoin(users, eq(users.id, consents.userId))
		.where(where);
	return {
		rows: rows.map((r) => ({ ...r, status: statusView(r.status, r.validUntil, now) })),
		total
	};
}
