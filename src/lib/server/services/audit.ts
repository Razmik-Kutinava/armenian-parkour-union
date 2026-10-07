import { isIP } from 'node:net';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { LimitDb } from '../auth/rate-limit';
import { auditLog } from '../db/schema/service';
import { users } from '../db/schema/users';

export type AuditEntry = {
	actorId: string | null;
	action: string;
	entityType?: string;
	entityId?: string;
	before?: unknown;
	after?: unknown;
	ip?: string | null;
};

/**
 * docs/02 section 10. Call inside the transaction of the action itself: the entry and the change
 * are saved together or not at all.
 */
export async function writeAudit(db: LimitDb, entry: AuditEntry): Promise<void> {
	await db.insert(auditLog).values({
		actorId: entry.actorId,
		action: entry.action,
		entityType: entry.entityType ?? null,
		entityId: entry.entityId ?? null,
		before: entry.before ?? null,
		after: entry.after ?? null,
		ip: entry.ip && isIP(entry.ip) ? entry.ip : null,
		// clock time, not transaction start: several entries of one transaction keep their order
		createdAt: sql`clock_timestamp()`
	});
}

export type HistoryEntry = {
	id: string;
	action: string;
	actorName: string | null;
	before: unknown;
	after: unknown;
	createdAt: Date;
};

/** Audit entries about one user, newest first (card tab "History", docs/05 section 6). */
export async function userHistory(
	db: LimitDb,
	userId: string,
	limit = 100
): Promise<HistoryEntry[]> {
	return db
		.select({
			id: auditLog.id,
			action: auditLog.action,
			actorName: users.name,
			before: auditLog.before,
			after: auditLog.after,
			createdAt: auditLog.createdAt
		})
		.from(auditLog)
		.leftJoin(users, eq(users.id, auditLog.actorId))
		.where(and(eq(auditLog.entityType, 'user'), eq(auditLog.entityId, userId)))
		.orderBy(desc(auditLog.createdAt))
		.limit(limit);
}
