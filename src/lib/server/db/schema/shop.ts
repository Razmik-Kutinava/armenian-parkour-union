import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { contentStatus, orderStatus } from './enums';
import { pointsLedger } from './points';
import { users } from './users';

/* docs/02-DATABASE.md section 7; `number`, NOT NULL and checks — decisions.md 2026-10-25 (7.3). */

const createdAt = timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = timestamp('updated_at', { withTimezone: true })
	.notNull()
	.defaultNow()
	.$onUpdate(() => new Date());

/** On sale when published and not deleted; `stock = 0` — out of stock (docs/03 section 9). */
export const shopItems = pgTable(
	'shop_items',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		slug: text('slug').notNull().unique(),
		title: jsonb('title').notNull(),
		description: jsonb('description').notNull().default({}),
		imageKeys: jsonb('image_keys').$type<string[]>().notNull().default([]),
		pricePoints: integer('price_points').notNull(),
		/** For example `{"size": ["S", "M", "L"]}`. */
		options: jsonb('options').$type<Record<string, string[]>>(),
		/** `null` — no limit. */
		stock: integer('stock'),
		status: contentStatus('status').notNull().default('draft'),
		sortOrder: integer('sort_order').notNull().default(0),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		createdAt,
		updatedAt
	},
	(t) => [
		check('shop_items_price_positive', sql`${t.pricePoints} > 0`),
		check('shop_items_stock_not_negative', sql`${t.stock} IS NULL OR ${t.stock} >= 0`),
		check('shop_items_image_keys_array', sql`jsonb_typeof(${t.imageKeys}) = 'array'`),
		check(
			'shop_items_options_object',
			sql`${t.options} IS NULL OR jsonb_typeof(${t.options}) = 'object'`
		)
	]
);

/** Points are spent by the `shop_order` ledger entry; a refund is `shop_refund` with this order id. */
export const shopOrders = pgTable(
	'shop_orders',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		/** `ORD-{year}-{0001}`, never reused. */
		number: text('number').notNull().unique(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id),
		status: orderStatus('status').notNull().default('new'),
		totalPoints: integer('total_points').notNull(),
		ledgerId: uuid('ledger_id')
			.unique()
			.references(() => pointsLedger.id),
		recipientName: text('recipient_name').notNull(),
		phone: text('phone').notNull(),
		city: text('city').notNull(),
		address: text('address').notNull(),
		comment: text('comment'),
		trackingNote: text('tracking_note'),
		createdAt,
		updatedAt
	},
	(t) => [
		index('shop_orders_user_id_idx').on(t.userId),
		index('shop_orders_status_created_at_idx').on(t.status, t.createdAt),
		check('shop_orders_total_positive', sql`${t.totalPoints} > 0`)
	]
);

/** Price is a snapshot: a later price change does not touch old orders. */
export const shopOrderItems = pgTable(
	'shop_order_items',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		orderId: uuid('order_id')
			.notNull()
			.references(() => shopOrders.id, { onDelete: 'cascade' }),
		itemId: uuid('item_id')
			.notNull()
			.references(() => shopItems.id),
		/** For example `{"size": "M"}`. */
		selectedOptions: jsonb('selected_options').$type<Record<string, string>>(),
		quantity: integer('quantity').notNull(),
		pricePointsSnapshot: integer('price_points_snapshot').notNull(),
		createdAt
	},
	(t) => [
		index('shop_order_items_order_id_idx').on(t.orderId),
		check('shop_order_items_quantity_positive', sql`${t.quantity} > 0`),
		check('shop_order_items_price_positive', sql`${t.pricePointsSnapshot} > 0`),
		check(
			'shop_order_items_options_object',
			sql`${t.selectedOptions} IS NULL OR jsonb_typeof(${t.selectedOptions}) = 'object'`
		)
	]
);
