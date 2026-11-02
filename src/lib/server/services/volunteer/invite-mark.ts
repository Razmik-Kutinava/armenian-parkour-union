import type { LimitDb } from '../../auth/rate-limit';
import type { Actor } from '../users/target';

/* docs/03 section 19.5 p. 5, 19.6–19.7 p. 1 — implemented in GREEN. */

export type MarkKind = 'attended' | 'no_show' | 'excused';
export type MarkResult =
	| 'ok'
	| 'not_found'
	| 'not_allowed'
	| 'wrong_status'
	| 'too_early'
	| 'request_closed';

export function marksOpen(_startsAt: Date, _now: Date) {
	return false;
}

export async function markInvite(
	_db: LimitDb,
	_actor: Actor,
	_invitationId: string,
	_kind: MarkKind,
	_ip: string | null,
	_now = new Date()
): Promise<MarkResult> {
	return 'not_found';
}

export async function finishRequest(
	_db: LimitDb,
	_actor: Actor,
	_requestId: string,
	_ip: string | null,
	_now = new Date()
): Promise<'ok' | 'not_found' | 'not_allowed' | 'bad_state'> {
	return 'not_found';
}
