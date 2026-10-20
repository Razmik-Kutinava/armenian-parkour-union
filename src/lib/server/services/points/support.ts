import { roleCan } from '../../auth/permissions';
import type { Actor } from '../users/target';

export type PointsAdminDeps = { ip: string | null };
export type PointsRefusal =
	| 'not_allowed'
	| 'invalid'
	| 'not_found'
	| 'insufficient_balance'
	| 'not_reversible'
	| 'already_reversed';
export type PointsAdminResult =
	{ ok: true; entryId: string; balance: number } | { ok: false; reason: PointsRefusal };

export const refuse = (reason: PointsRefusal): PointsAdminResult => ({ ok: false, reason });

/** docs/04 section 5 p. 6: the service checks the right itself, wherever the call comes from. */
export const canAdjust = (actor: Actor) => roleCan(actor.role, 'points.adjust');

/** docs/03 section 6.3: manual entries and reversals need a comment; `null` — none given. */
export function cleanComment(comment: string): string | null {
	const trimmed = comment.trim();
	return trimmed ? trimmed : null;
}
