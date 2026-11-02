import type { LimitDb } from '../../auth/rate-limit';
import type { Mail } from '../../mail/resend';

/* docs/03 section 19.5 p. 4, 19.6 — implemented in GREEN. */

export type CloseMailDeps = { send: (mail: Mail) => Promise<void>; siteUrl: string };

export async function closeRequestInvites(
	_db: LimitDb,
	_requestId: string,
	_now = new Date(),
	_deps?: CloseMailDeps
): Promise<{ ok: true; already?: boolean } | { ok: false; reason: 'not_found' | 'too_early' }> {
	return { ok: false, reason: 'not_found' };
}

export async function closeDueRequests(
	_db: LimitDb,
	_now = new Date(),
	_deps?: CloseMailDeps
): Promise<{ closed: number; failed: number }> {
	return { closed: 0, failed: 0 };
}
