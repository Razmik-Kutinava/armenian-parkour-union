import { sql } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { shopOrders } from '../../db/schema/shop';

/* decisions.md 2026-10-25 (7.3): `ORD-{year}-{0001}`, year by Yerevan, never reused — cancelled
 * orders keep their numbers. One order at a time takes the next number (advisory lock till the
 * commit); unique(`number`) is the last guard. */

const orderYear = (at: Date) =>
	Number(at.toLocaleString('en-US', { year: 'numeric', timeZone: 'Asia/Yerevan' }));

export async function nextOrderNumber(tx: LimitDb, at: Date): Promise<string> {
	const year = orderYear(at);
	await tx.execute(sql`select pg_advisory_xact_lock(hashtext('shop_order_number'))`);
	const [row] = await tx
		.select({ last: sql<number | null>`max(split_part(${shopOrders.number}, '-', 3)::bigint)` })
		.from(shopOrders)
		.where(sql`${shopOrders.number} ~ ${`^ORD-${year}-[0-9]+$`}`);
	return `ORD-${year}-${String(Number(row?.last ?? 0) + 1).padStart(4, '0')}`;
}
