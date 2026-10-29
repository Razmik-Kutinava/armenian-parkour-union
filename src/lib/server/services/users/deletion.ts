import { eq } from 'drizzle-orm';
import { blockError, type AccountRuleError } from '../../auth/role-rules';
import type { LimitDb } from '../../auth/rate-limit';
import { session } from '../../db/schema/auth';
import { users } from '../../db/schema/users';
import { writeAudit } from '../audit';
import { lockActiveAdmins, lockTarget, type Actor } from './target';

/* decisions.md 2026-10-22: only an admin, only on the member's request. Deletion is soft
 * (docs/03 section 1 p. 6): points, payments and certificates stay; every session ends. */

export type DeletionResult = 'ok' | 'not_found' | 'not_requested' | AccountRuleError;

export async function deleteAccount(
	db: LimitDb,
	actor: Actor,
	targetId: string,
	ip: string | null,
	now = new Date()
): Promise<DeletionResult> {
	if (actor.role !== 'admin') return 'not_admin';
	return db.transaction(async (tx) => {
		const admins = await lockActiveAdmins(tx);
		const target = await lockTarget(tx, targetId);
		if (!target) return 'not_found';
		const refused = blockError(actor, target, admins);
		if (refused) return refused;
		if (!target.deletionRequestedAt) return 'not_requested';
		await tx.update(users).set({ deletedAt: now }).where(eq(users.id, target.id));
		await tx.delete(session).where(eq(session.userId, target.id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'user.delete',
			entityType: 'user',
			entityId: target.id,
			before: { deletionRequestedAt: target.deletionRequestedAt.toISOString() },
			after: { deletedAt: now.toISOString() },
			ip
		});
		return 'ok';
	});
}

export async function declineDeletion(
	db: LimitDb,
	actor: Actor,
	targetId: string,
	ip: string | null
): Promise<DeletionResult> {
	if (actor.role !== 'admin') return 'not_admin';
	return db.transaction(async (tx) => {
		const target = await lockTarget(tx, targetId);
		if (!target) return 'not_found';
		if (!target.deletionRequestedAt) return 'not_requested';
		await tx.update(users).set({ deletionRequestedAt: null }).where(eq(users.id, target.id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'user.deletion_reject',
			entityType: 'user',
			entityId: target.id,
			before: { deletionRequestedAt: target.deletionRequestedAt.toISOString() },
			ip
		});
		return 'ok';
	});
}
