import { PUBLIC_SITE_URL } from '$app/env/private';
import type { LimitDb } from '../../auth/rate-limit';
import { publicCache } from '../../cache';
import { sendMail } from '../../mail';
import { placeOrder, type PlaceOrderInput } from './checkout';

/* The order wired to the real mail. A member writes it, not staff, so the admin hook does not drop
 * the cache: "out of stock" in the catalog would lag behind. */
export async function placeOrderNow(db: LimitDb, userId: string, input: PlaceOrderInput) {
	const result = await placeOrder(db, userId, input, { send: sendMail, siteUrl: PUBLIC_SITE_URL });
	if (result.ok && !result.repeated) publicCache.invalidate(['shop']);
	return result;
}
