import { and, eq, isNull } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { shopItems } from '../../db/schema/shop';
import { users } from '../../db/schema/users';
import { onSale } from './public';

/* Rows the order transaction reads under its locks (checkout.ts). */

/** Exactly the item's option names, each value from its list; `null` — the item has none. */
export function pickOptions(
	defined: Record<string, string[]> | null,
	chosen: Record<string, string>
): Record<string, string> | null | undefined {
	const names = Object.keys(defined ?? {});
	if (Object.keys(chosen).length !== names.length) return undefined;
	const valid = names.every((n) => Object.hasOwn(chosen, n) && defined![n].includes(chosen[n]));
	if (!valid) return undefined;
	return names.length ? Object.fromEntries(names.map((n) => [n, chosen[n]])) : null;
}

/** The member row, locked like `appendEntry` does; the letter fields come with it. */
export const lockBuyer = async (tx: LimitDb, userId: string) =>
	(
		await tx
			.select({
				status: users.status,
				emailVerified: users.emailVerified,
				balance: users.pointsBalance,
				email: users.email,
				locale: users.locale,
				firstName: users.firstName,
				name: users.name
			})
			.from(users)
			.where(and(eq(users.id, userId), isNull(users.deletedAt)))
			.for('no key update')
	)[0];

/** For the confirmation step ("balance after the order"); `null` — no such member. */
export async function ownBalance(db: LimitDb, userId: string): Promise<number | null> {
	const [row] = await db
		.select({ balance: users.pointsBalance })
		.from(users)
		.where(and(eq(users.id, userId), isNull(users.deletedAt)));
	return row?.balance ?? null;
}

export const lockItemOnSale = async (tx: LimitDb, itemId: string) =>
	(
		await tx
			.select({
				id: shopItems.id,
				price: shopItems.pricePoints,
				stock: shopItems.stock,
				options: shopItems.options
			})
			.from(shopItems)
			.where(and(onSale, eq(shopItems.id, itemId)))
			.for('update')
	)[0];
