import { PUBLIC_SITE_URL } from '$app/env/private';
import type { LimitDb } from '../../auth/rate-limit';
import { sendMail } from '../../mail';
import type { Actor } from '../users/target';
import { cancelOrder } from './order-cancel';
import { changeOrderStatus } from './orders';

/* The status change and the cancel wired to the real mail. */
const deps = (ip: string | null) => ({ send: sendMail, siteUrl: PUBLIC_SITE_URL, ip });

export const changeOrderStatusNow = (
	db: LimitDb,
	actor: Actor,
	id: string,
	status: string,
	ip: string | null
) => changeOrderStatus(db, actor, id, status, deps(ip));

export const cancelOrderNow = (db: LimitDb, actor: Actor, id: string, ip: string | null) =>
	cancelOrder(db, actor, id, deps(ip));
