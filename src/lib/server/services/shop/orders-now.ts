import { PUBLIC_SITE_URL } from '$app/env/private';
import type { LimitDb } from '../../auth/rate-limit';
import { publicCache } from '../../cache';
import { sendMail } from '../../mail';
import type { Actor } from '../users/target';
import { cancelOrder, cancelOwnOrder } from './order-cancel';
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

/** From the cabinet, not the admin: the hook does not drop the shop cache, so the stock is stale. */
export async function cancelOwnOrderNow(
	db: LimitDb,
	userId: string,
	id: string,
	ip: string | null
) {
	const result = await cancelOwnOrder(db, userId, id, deps(ip));
	if (result === 'ok') publicCache.invalidate(['shop']);
	return result;
}
