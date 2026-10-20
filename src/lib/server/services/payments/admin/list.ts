import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import {
	PAGE_SIZE,
	pageOffset,
	type ListOptions,
	type ListState
} from '#lib/components/admin/list-state.ts';
import type { LimitDb } from '../../../auth/rate-limit';
import { paymentKind, paymentStatus } from '../../../db/schema/enums';
import { payments } from '../../../db/schema/payments';
import { users } from '../../../db/schema/users';
import { validDay, ZONE } from '../../audit-list';
import { isUuid } from '../../users/target';
import type { PaymentKind } from '../effects';
import type { PaymentStatus } from '../transitions';

/* docs/05 section 16: list of payments; filter values are checked before reaching SQL. */

export const paymentListOptions: ListOptions = {
	sortable: ['createdAt', 'amount'],
	filters: ['kind', 'status', 'provider', 'review', 'from', 'to'],
	defaultSort: { key: 'createdAt', dir: 'desc' }
};

export type PaymentListRow = {
	id: string;
	createdAt: Date;
	kind: PaymentKind;
	status: PaymentStatus;
	amountMinor: number;
	currency: string;
	provider: string;
	needsReview: boolean;
	userId: string | null;
	payerName: string | null;
	payerEmail: string | null;
};

const PROVIDER = /^[a-z0-9_-]{1,32}$/;
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const oneOf = <T extends string>(values: readonly T[], value: string | undefined) =>
	values.includes(value as T) ? (value as T) : undefined;

/** A member by the account, a guest by the donation form. */
export const payerName = sql<string | null>`coalesce(${users.name}, ${payments.donorName})`;
export const payerEmail = sql<string | null>`coalesce(${users.email}, ${payments.donorEmail})`;

function conditions(state: ListState): SQL | undefined {
	const f = state.filters;
	const where: (SQL | undefined)[] = [];
	if (state.q) {
		const like = `%${escapeLike(state.q)}%`;
		where.push(
			or(
				ilike(users.name, like),
				ilike(users.email, like),
				ilike(payments.donorName, like),
				ilike(payments.donorEmail, like),
				ilike(payments.providerPaymentId, like),
				isUuid(state.q) ? eq(payments.id, state.q) : undefined
			)
		);
	}
	const kind = oneOf(paymentKind.enumValues, f.kind);
	if (kind) where.push(eq(payments.kind, kind));
	const status = oneOf(paymentStatus.enumValues, f.status);
	if (status) where.push(eq(payments.status, status));
	if (f.provider && PROVIDER.test(f.provider)) where.push(eq(payments.provider, f.provider));
	if (f.review === '1') where.push(eq(payments.needsReview, true));
	const from = validDay(f.from);
	if (from)
		where.push(sql`${payments.createdAt} >= (${from}::date)::timestamp at time zone ${ZONE}`);
	const to = validDay(f.to);
	if (to)
		where.push(sql`${payments.createdAt} < (${to}::date + 1)::timestamp at time zone ${ZONE}`);
	return and(...where);
}

export async function listPayments(
	db: LimitDb,
	state: ListState
): Promise<{ rows: PaymentListRow[]; total: number }> {
	const where = conditions(state);
	const column = state.sort === 'amount' ? payments.amountMinor : payments.createdAt;
	const order = state.dir === 'asc' ? asc(column) : desc(column);
	const rows = await db
		.select({
			id: payments.id,
			createdAt: payments.createdAt,
			kind: payments.kind,
			status: payments.status,
			amountMinor: payments.amountMinor,
			currency: payments.currency,
			provider: payments.provider,
			needsReview: payments.needsReview,
			userId: payments.userId,
			payerName,
			payerEmail
		})
		.from(payments)
		.leftJoin(users, eq(users.id, payments.userId))
		.where(where)
		.orderBy(order, desc(payments.id))
		.limit(PAGE_SIZE)
		.offset(pageOffset(state.page));
	const [{ total }] = await db
		.select({ total: count() })
		.from(payments)
		.leftJoin(users, eq(users.id, payments.userId))
		.where(where);
	return { rows, total };
}

/** Providers for the filter: only those payments already have. */
export async function paymentProviderOptions(db: LimitDb): Promise<string[]> {
	const rows = await db
		.selectDistinct({ provider: payments.provider })
		.from(payments)
		.orderBy(asc(payments.provider))
		.limit(50);
	return rows.map((r) => r.provider);
}
