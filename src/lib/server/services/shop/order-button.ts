import { and, eq, isNull } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { shopItems } from '../../db/schema/shop';
import { users } from '../../db/schema/users';
import { isUuid } from '../users/target';
import { onSale } from './public';

/* docs/06 section 4.7 (button table), docs/03 section 9 items 1 and 3; decisions — todo 7.5 (4). */

export type OrderButton =
	| { state: 'none' }
	| { state: 'out_of_stock' }
	| { state: 'guest' }
	| { state: 'email_unverified' }
	| { state: 'short'; missing: number }
	| { state: 'can_order'; price: number };

/** Stock and balance are read now, not from the cache: the cached item card may lag. */
export async function orderButton(
	db: LimitDb,
	userId: string | null,
	itemId: string
): Promise<OrderButton> {
	if (!isUuid(itemId)) return { state: 'none' };
	const [item] = await db
		.select({ price: shopItems.pricePoints, stock: shopItems.stock })
		.from(shopItems)
		.where(and(onSale, eq(shopItems.id, itemId)));
	if (!item) return { state: 'none' };
	if (item.stock === 0) return { state: 'out_of_stock' };
	if (!userId || !isUuid(userId)) return { state: 'guest' };
	const [user] = await db
		.select({ balance: users.pointsBalance, emailVerified: users.emailVerified })
		.from(users)
		.where(and(eq(users.id, userId), eq(users.status, 'active'), isNull(users.deletedAt)));
	if (!user) return { state: 'guest' };
	if (!user.emailVerified) return { state: 'email_unverified' };
	if (user.balance < item.price) return { state: 'short', missing: item.price - user.balance };
	return { state: 'can_order', price: item.price };
}
