import type postgres from 'postgres';
import type { AdminAction } from './admin-audit-map';

type ShopAction = Extract<AdminAction, `/admin/products${string}` | `/admin/orders${string}`>;
type Post = (path: string, form?: Record<string, string>) => Promise<void>;

/** Products and orders for admin-audit.spec.ts: the product by its address, an order of the target. */
export function shopActions(
	sql: postgres.Sql,
	post: Post,
	postRedirect: Post,
	target: string
): Record<ShopAction, () => Promise<void>> {
	const slug = `e2e-audit-${crypto.randomUUID().slice(0, 8)}`;
	const form = { slug, 'title.en': 'Audit product', pricePoints: '100', status: 'draft' };
	const itemId = async () =>
		(await sql`select id from shop_items where slug = ${slug}`)[0].id as string;
	const newOrder = async () => {
		const [row] = await sql`insert into shop_orders
			(number, user_id, total_points, recipient_name, phone, city, address)
			values (${`ORD-2099-${crypto.randomUUID().slice(0, 8)}`}, ${target}, 100, 'Audit', '+37400000000',
				'Yerevan', 'Audit street 1') returning id`;
		await sql`insert into shop_order_items (order_id, item_id, quantity, price_points_snapshot)
			values (${row.id}, ${await itemId()}, 1, 100)`;
		return row.id as string;
	};
	let orderId: string | null = null;
	const order = async () => (orderId ??= await newOrder());
	return {
		'/admin/products/new?/default': () => postRedirect('/admin/products/new', form),
		'/admin/products/[id]?/update': async () =>
			post(`/admin/products/${await itemId()}?/update`, { ...form, pricePoints: '120' }),
		'/admin/products/[id]?/status': async () =>
			post(`/admin/products/${await itemId()}?/status`, { action: 'publish' }),
		'/admin/products/[id]?/duplicate': async () =>
			postRedirect(`/admin/products/${await itemId()}?/duplicate`),
		'/admin/orders/[id]?/status': async () =>
			post(`/admin/orders/${await order()}?/status`, { status: 'confirmed' }),
		'/admin/orders/[id]?/tracking': async () =>
			post(`/admin/orders/${await order()}?/tracking`, { trackingNote: 'Audit note' }),
		/* Its own order: the shared one must stay open for the status and the note. */
		'/admin/orders/[id]?/cancel': async () => post(`/admin/orders/${await newOrder()}?/cancel`)
	};
}
