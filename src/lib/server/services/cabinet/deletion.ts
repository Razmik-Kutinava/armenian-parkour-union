import { and, eq, isNull } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { users } from '../../db/schema/users';
import { writeAudit } from '../audit';
import { isUuid } from '../users/target';

/* docs/06 section 5.2, decisions.md 2026-10-22: the member only asks; an admin deletes or declines
 * (services/users/deletion.ts). The first date of a request is kept until it is taken back. */

type Result = 'ok' | 'not_found';

async function lockOwn(tx: LimitDb, userId: string) {
	const [row] = await tx
		.select({ requestedAt: users.deletionRequestedAt })
		.from(users)
		.where(and(eq(users.id, userId), isNull(users.deletedAt)))
		.for('update');
	return row ?? null;
}

export async function requestOwnDeletion(
	db: LimitDb,
	userId: string,
	ip: string | null,
	now = new Date()
): Promise<Result> {
	if (!isUuid(userId)) return 'not_found';
	return db.transaction(async (tx) => {
		const own = await lockOwn(tx, userId);
		if (!own) return 'not_found';
		if (own.requestedAt) return 'ok';
		await tx.update(users).set({ deletionRequestedAt: now }).where(eq(users.id, userId));
		await writeAudit(tx, {
			actorId: userId,
			action: 'user.deletion_request',
			entityType: 'user',
			entityId: userId,
			after: { deletionRequestedAt: now.toISOString() },
			ip
		});
		return 'ok';
	});
}

export async function cancelOwnDeletion(
	db: LimitDb,
	userId: string,
	ip: string | null
): Promise<Result> {
	if (!isUuid(userId)) return 'not_found';
	return db.transaction(async (tx) => {
		const own = await lockOwn(tx, userId);
		if (!own) return 'not_found';
		if (!own.requestedAt) return 'ok';
		await tx.update(users).set({ deletionRequestedAt: null }).where(eq(users.id, userId));
		await writeAudit(tx, {
			actorId: userId,
			action: 'user.deletion_cancel',
			entityType: 'user',
			entityId: userId,
			before: { deletionRequestedAt: own.requestedAt.toISOString() },
			ip
		});
		return 'ok';
	});
}
