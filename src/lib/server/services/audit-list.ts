import { and, asc, count, desc, eq, ilike, isNotNull, or, sql, type SQL } from 'drizzle-orm';
import {
	PAGE_SIZE,
	pageOffset,
	type ListOptions,
	type ListState
} from '#lib/components/admin/list-state.ts';
import type { LimitDb } from '../auth/rate-limit';
import { auditLog } from '../db/schema/service';
import { users } from '../db/schema/users';
import { isUuid } from './users/target';

/* docs/05 section 22: read-only list of audit_log with filters in the URL. */

export const auditListOptions: ListOptions = {
	sortable: ['createdAt'],
	filters: ['action', 'entity', 'from', 'to'],
	defaultSort: { key: 'createdAt', dir: 'desc' }
};

export type AuditRow = {
	id: string;
	createdAt: Date;
	actorName: string | null;
	action: string;
	entityType: string | null;
	entityId: string | null;
	ip: string | null;
};
export type AuditEntryFull = AuditRow & { before: unknown; after: unknown };

const CODE = /^[a-z0-9_.:-]{1,64}$/;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
/** "From" and "to" are calendar days in Yerevan, where the federation works. */
const ZONE = 'Asia/Yerevan';

function validDay(value: string | undefined): string | undefined {
	const m = value ? DAY.exec(value) : null;
	if (!m) return undefined;
	const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
	return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? value : undefined;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

function conditions(state: ListState): SQL | undefined {
	const f = state.filters;
	const where: (SQL | undefined)[] = [];
	if (state.q) {
		const like = `%${escapeLike(state.q)}%`;
		where.push(or(ilike(users.name, like), ilike(users.email, like)));
	}
	if (f.action && CODE.test(f.action)) where.push(eq(auditLog.action, f.action));
	if (f.entity && CODE.test(f.entity)) where.push(eq(auditLog.entityType, f.entity));
	const from = validDay(f.from);
	if (from)
		where.push(sql`${auditLog.createdAt} >= (${from}::date)::timestamp at time zone ${ZONE}`);
	const to = validDay(f.to);
	if (to)
		where.push(sql`${auditLog.createdAt} < (${to}::date + 1)::timestamp at time zone ${ZONE}`);
	return and(...where);
}

const columns = {
	id: auditLog.id,
	createdAt: auditLog.createdAt,
	actorName: users.name,
	action: auditLog.action,
	entityType: auditLog.entityType,
	entityId: auditLog.entityId,
	ip: sql<string | null>`host(${auditLog.ip})`
};

export async function listAudit(
	db: LimitDb,
	state: ListState
): Promise<{ rows: AuditRow[]; total: number }> {
	const where = conditions(state);
	const order = state.dir === 'asc' ? asc(auditLog.createdAt) : desc(auditLog.createdAt);
	const rows = await db
		.select(columns)
		.from(auditLog)
		.leftJoin(users, eq(users.id, auditLog.actorId))
		.where(where)
		.orderBy(order, desc(auditLog.id))
		.limit(PAGE_SIZE)
		.offset(pageOffset(state.page));
	const [{ total }] = await db
		.select({ total: count() })
		.from(auditLog)
		.leftJoin(users, eq(users.id, auditLog.actorId))
		.where(where);
	return { rows, total };
}

/** CSV export: same filters, newest first, with before / after; capped so a click cannot hang the server. */
export async function auditForExport(
	db: LimitDb,
	state: ListState,
	max = 10_000
): Promise<AuditEntryFull[]> {
	return db
		.select({ ...columns, before: auditLog.before, after: auditLog.after })
		.from(auditLog)
		.leftJoin(users, eq(users.id, auditLog.actorId))
		.where(conditions(state))
		.orderBy(desc(auditLog.createdAt), desc(auditLog.id))
		.limit(max);
}

export async function getAuditEntry(db: LimitDb, id: string): Promise<AuditEntryFull | null> {
	if (!isUuid(id)) return null;
	const [row] = await db
		.select({ ...columns, before: auditLog.before, after: auditLog.after })
		.from(auditLog)
		.leftJoin(users, eq(users.id, auditLog.actorId))
		.where(eq(auditLog.id, id));
	return row ?? null;
}

/** Values for the "action" and "object" filters: only what the log already has. */
export async function auditFilterOptions(db: LimitDb) {
	const [actions, entities] = await Promise.all([
		db
			.selectDistinct({ v: auditLog.action })
			.from(auditLog)
			.orderBy(asc(auditLog.action))
			.limit(300),
		db
			.selectDistinct({ v: auditLog.entityType })
			.from(auditLog)
			.where(isNotNull(auditLog.entityType))
			.orderBy(asc(auditLog.entityType))
			.limit(100)
	]);
	return {
		actions: actions.map((r) => r.v),
		entities: entities.map((r) => r.v).filter((v): v is string => !!v)
	};
}
