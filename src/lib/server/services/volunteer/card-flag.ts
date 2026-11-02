import type { LimitDb } from '../../auth/rate-limit';
import type { Actor } from '../users/target';

/* docs/03 section 19.6 pp. 3–4 — implemented in GREEN. */

export async function clearCardFlag(
	_db: LimitDb,
	_actor: Actor,
	_cardId: string,
	_ip: string | null
): Promise<{ ok: true } | { ok: false; reason: 'not_allowed' | 'not_found' | 'bad_state' }> {
	return { ok: false, reason: 'not_found' };
}
