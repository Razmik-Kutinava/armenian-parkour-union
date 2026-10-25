import { PUBLIC_SITE_URL } from '$app/env/private';
import type { LimitDb } from '../../auth/rate-limit';
import { sendMail } from '../../mail';
import type { Actor } from '../users/target';
import { changeOrderStatus } from './orders';

/* The status change wired to the real mail. */
export const changeOrderStatusNow = (
	db: LimitDb,
	actor: Actor,
	id: string,
	status: string,
	ip: string | null
) => changeOrderStatus(db, actor, id, status, { send: sendMail, siteUrl: PUBLIC_SITE_URL, ip });
