import { eq } from 'drizzle-orm';
import { blockError, roleChangeError, type AccountRuleError } from '../../auth/role-rules';
import type { LimitDb } from '../../auth/rate-limit';
import type { UserRole } from '../../auth/session';
import { session } from '../../db/schema/auth';
import { users } from '../../db/schema/users';
import { writeAudit } from '../audit';
import { lockActiveAdmins, lockTarget, type Actor } from './target';

export type AccountResult = 'ok' | 'not_found' | AccountRuleError;

/* docs/04 section 6, docs/05 sections 6 and 23. Every change and its audit entry share a transaction. */

export async function changeRole(
	db: LimitDb,
	actor: Actor,
	targetId: string,
	role: UserRole,
	ip: string | null
): Promise<AccountResult> {
	if (actor.role !== 'admin') return 'not_admin';
	return db.transaction(async (tx) => {
		const admins = await lockActiveAdmins(tx);
		const target = await lockTarget(tx, targetId);
		if (!target) return 'not_found';
		const refused = roleChangeError(actor, target, role, admins);
		if (refused) return refused;
		if (target.role === role) return 'ok';
		await tx.update(users).set({ role }).where(eq(users.id, target.id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'user.role_change',
			entityType: 'user',
			entityId: target.id,
			before: { role: target.role },
			after: { role },
			ip
		});
		return 'ok';
	});
}

/** Blocking ends every session at once (docs/04 section 6.8); the reason goes to the audit log. */
export async function setBlocked(
	db: LimitDb,
	actor: Actor,
	targetId: string,
	blocked: boolean,
	reason: string | null,
	ip: string | null
): Promise<AccountResult> {
	if (actor.role !== 'admin') return 'not_admin';
	return db.transaction(async (tx) => {
		const admins = await lockActiveAdmins(tx);
		const target = await lockTarget(tx, targetId);
		if (!target) return 'not_found';
		if (blocked) {
			const refused = blockError(actor, target, admins);
			if (refused) return refused;
		} else if (actor.id === target.id) return 'self';
		const status = blocked ? 'blocked' : 'active';
		if (blocked) await tx.delete(session).where(eq(session.userId, target.id));
		if (target.status === status) return 'ok';
		await tx.update(users).set({ status }).where(eq(users.id, target.id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: blocked ? 'user.block' : 'user.unblock',
			entityType: 'user',
			entityId: target.id,
			before: { status: target.status },
			after: reason ? { status, reason } : { status },
			ip
		});
		return 'ok';
	});
}

export async function confirmEmail(
	db: LimitDb,
	actor: Actor,
	targetId: string,
	ip: string | null
): Promise<AccountResult> {
	if (actor.role !== 'admin') return 'not_admin';
	return db.transaction(async (tx) => {
		const target = await lockTarget(tx, targetId);
		if (!target) return 'not_found';
		if (target.emailVerified) return 'ok';
		await tx.update(users).set({ emailVerified: true }).where(eq(users.id, target.id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'user.email_confirm',
			entityType: 'user',
			entityId: target.id,
			before: { emailVerified: false },
			after: { emailVerified: true },
			ip
		});
		return 'ok';
	});
}
