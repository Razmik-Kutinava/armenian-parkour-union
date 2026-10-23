import { PUBLIC_SITE_URL } from '$app/env/private';
import type { LimitDb } from '../../auth/rate-limit';
import { sendMail } from '../../mail';
import type { Actor } from '../users/target';
import { cancelEvent } from './lifecycle';

/** The route's cancel: the members whose registrations went get letters. */
export function cancelEventNow(
	db: LimitDb,
	actor: Actor,
	id: string,
	reason: string,
	ip: string | null
) {
	return cancelEvent(db, actor, id, reason, ip, { send: sendMail, siteUrl: PUBLIC_SITE_URL });
}
