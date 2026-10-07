import type { UserRole } from './session';

type Actor = { id: string; role: UserRole };
type Target = { id: string; role: UserRole; status: 'active' | 'blocked' };
export type AccountRuleError = 'not_admin' | 'self' | 'last_admin';

/*
 * docs/04 section 6. `activeAdmins` must be counted in the same transaction as the change
 * (row lock), otherwise two admins could demote each other at once.
 */

const isLastActiveAdmin = (target: Target, activeAdmins: number) =>
	target.role === 'admin' && target.status === 'active' && activeAdmins <= 1;

/** Roles are assigned only by an admin, never to oneself, and one active admin always stays. */
export function roleChangeError(
	actor: Actor,
	target: Target,
	newRole: UserRole,
	activeAdmins: number
): AccountRuleError | null {
	if (actor.role !== 'admin') return 'not_admin';
	if (actor.id === target.id) return 'self';
	if (newRole !== 'admin' && isLastActiveAdmin(target, activeAdmins)) return 'last_admin';
	return null;
}

/** Same rules for blocking and deleting an account. */
export function blockError(
	actor: Actor,
	target: Target,
	activeAdmins: number
): AccountRuleError | null {
	if (actor.role !== 'admin') return 'not_admin';
	if (actor.id === target.id) return 'self';
	if (isLastActiveAdmin(target, activeAdmins)) return 'last_admin';
	return null;
}

/**
 * Editor and moderator never reach accounts of their own role or higher (section 6.5). The
 * document sets no order between editor and moderator, so they only reach members.
 */
export function canManageUser(actor: { role: UserRole }, targetRole: UserRole): boolean {
	if (actor.role === 'admin') return true;
	if (actor.role === 'member') return false;
	return targetRole === 'member';
}
