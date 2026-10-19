import { createHash, timingSafeEqual } from 'node:crypto';

const MIN_SECRET_LENGTH = 32;

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * HTTP status for an internal scheduled call: 404 — `CRON_SECRET` is not set (or too short to
 * trust), 401 — no or wrong `Authorization: Bearer`, 200 — allowed.
 */
export function cronAccess(header: string | null, secret: string | undefined): 200 | 401 | 404 {
	if (!secret || secret.length < MIN_SECRET_LENGTH) return 404;
	const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
	return token && timingSafeEqual(digest(token), digest(secret)) ? 200 : 401;
}
