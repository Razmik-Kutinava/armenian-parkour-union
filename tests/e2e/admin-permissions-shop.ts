import type postgres from 'postgres';

/* Product and order rows for admin-permissions.spec.ts (admin-permissions-fixtures.ts is over its
 * size). */
export type ShopIds = { productId: string; orderId: string };

export const shopPath = (path: string, ids: ShopIds) =>
	path
		.replace('/products/[id]', `/products/${ids.productId}`)
		.replace('/orders/[id]', `/orders/${ids.orderId}`);

export function shopFixtures(sql: postgres.Sql) {
	return {
		/* A draft product and a new order of the target: publish, duplicate, a status and a note could
		 * really run on them. */
		insertShop: async (userId: string): Promise<ShopIds> => {
			const tag = crypto.randomUUID().slice(0, 8);
			const [item] = await sql`insert into shop_items (slug, title, price_points)
				values (${`e2e-perm-${tag}`}, ${sql.json({ en: 'E2e perm product' })}, 10) returning id`;
			const [order] = await sql`insert into shop_orders
				(number, user_id, total_points, recipient_name, phone, city, address)
				values (${`ORD-2099-P${tag}`}, ${userId}, 10, 'Perm', '+37400000000', 'Yerevan', 'Perm 1')
				returning id`;
			await sql`insert into shop_order_items (order_id, item_id, quantity, price_points_snapshot)
				values (${order.id}, ${item.id}, 1, 10)`;
			return { productId: item.id, orderId: order.id };
		},
		shopRows: async (ids: ShopIds) => {
			const [item] = await sql`select * from shop_items where id = ${ids.productId}`;
			return {
				item,
				order: (await sql`select * from shop_orders where id = ${ids.orderId}`)[0],
				created: await sql`select slug from shop_items
					where slug like 'e2e-hostile-%' or slug like ${`${item.slug}-copy%`}`
			};
		}
	};
}
