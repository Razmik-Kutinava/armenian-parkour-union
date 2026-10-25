import { existsSync } from 'node:fs';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.DATABASE_URL;

class Rollback extends Error {}

/* docs/02 section 7, docs/03 section 9; `number`, NOT NULL and checks — decisions.md 2026-10-25 (7.3). */
describe.skipIf(!url)('shop schema (migration 0015)', () => {
	const sql = postgres(url ?? '', { max: 1, onnotice: () => {} });
	afterAll(() => sql.end());

	async function inRollback(fn: (tx: postgres.TransactionSql) => Promise<void>) {
		await sql
			.begin(async (tx) => {
				await fn(tx);
				throw new Rollback();
			})
			.catch((e) => {
				if (!(e instanceof Rollback)) throw e;
			});
	}

	async function expectCode(
		tx: postgres.TransactionSql,
		code: string,
		query: () => Promise<unknown>
	) {
		const error = await tx.savepoint(() => query()).catch((e: unknown) => e);
		expect((error as postgres.PostgresError).code).toBe(code);
	}

	const uid = () => crypto.randomUUID();
	const newUser = (tx: postgres.TransactionSql) =>
		tx`insert into users (email, name) values (${`t-${uid()}@example.com`}, 'Test')
			returning *`.then((r) => r[0]);
	const insert = (tx: postgres.TransactionSql, table: string, values: Record<string, unknown>) =>
		tx`insert into ${tx(table)} ${tx(values)} returning *`.then((r) => r[0]);
	const item = (tx: postgres.TransactionSql, values: Record<string, unknown> = {}) =>
		insert(tx, 'shop_items', {
			slug: `t-${uid()}`,
			title: tx.json({ en: 'T-shirt' }),
			price_points: 50,
			...values
		});
	const order = (
		tx: postgres.TransactionSql,
		userId: string,
		values: Record<string, unknown> = {}
	) =>
		insert(tx, 'shop_orders', {
			user_id: userId,
			number: `ORD-2026-${uid().slice(0, 8)}`,
			total_points: 50,
			recipient_name: 'Ani',
			phone: '+37491000000',
			city: 'Yerevan',
			address: 'Abovyan 1',
			...values
		});
	const line = (tx: postgres.TransactionSql, values: Record<string, unknown>) =>
		insert(tx, 'shop_order_items', { quantity: 1, price_points_snapshot: 50, ...values });

	it('an item starts as an unlimited draft without images; slug is unique', async () => {
		await inRollback(async (tx) => {
			const row = await item(tx, { slug: 't-shop-slug' });
			expect(row).toMatchObject({
				description: {},
				image_keys: [],
				options: null,
				stock: null,
				status: 'draft',
				sort_order: 0,
				deleted_at: null
			});
			for (const key of ['created_at', 'updated_at']) expect(row[key]).toBeInstanceOf(Date);
			await expectCode(tx, '23505', () => item(tx, { slug: 't-shop-slug' }));
		});
	});

	it('item price above zero, stock not negative, title required, json shapes checked', async () => {
		await inRollback(async (tx) => {
			await item(tx, { stock: 0, options: tx.json({ size: ['S', 'M'] }) });
			await item(tx, { image_keys: tx.json(['media/a.jpg', 'media/b.jpg']) });
			await expectCode(tx, '23514', () => item(tx, { price_points: 0 }));
			await expectCode(tx, '23502', () => item(tx, { price_points: null }));
			await expectCode(tx, '23514', () => item(tx, { stock: -1 }));
			await expectCode(tx, '23502', () => item(tx, { title: null }));
			await expectCode(tx, '23514', () => item(tx, { image_keys: tx.json({ a: 1 }) }));
			await expectCode(tx, '23514', () => item(tx, { options: tx.json(['S']) }));
			await expectCode(tx, '22P02', () => item(tx, { status: 'hidden' }));
		});
	});

	it('an order starts new; number unique; delivery data and total required', async () => {
		await inRollback(async (tx) => {
			const user = await newUser(tx);
			const row = await order(tx, user.id, { number: 'ORD-2026-0001' });
			expect(row).toMatchObject({
				status: 'new',
				ledger_id: null,
				comment: null,
				tracking_note: null
			});
			for (const key of ['created_at', 'updated_at']) expect(row[key]).toBeInstanceOf(Date);
			await expectCode(tx, '23505', () => order(tx, user.id, { number: 'ORD-2026-0001' }));
			await expectCode(tx, '23502', () => order(tx, user.id, { number: null }));
			for (const key of ['recipient_name', 'phone', 'city', 'address', 'user_id']) {
				await expectCode(tx, '23502', () => order(tx, user.id, { [key]: null }));
			}
			await expectCode(tx, '23514', () => order(tx, user.id, { total_points: 0 }));
			for (const status of ['confirmed', 'shipped', 'delivered', 'cancelled']) {
				await order(tx, user.id, { status });
			}
			await expectCode(tx, '22P02', () => order(tx, user.id, { status: 'paid' }));
		});
	});

	it('one ledger entry pays for one order only', async () => {
		await inRollback(async (tx) => {
			const user = await newUser(tx);
			const [entry] = await tx`insert into points_ledger
				(user_id, delta, reason, source_type, source_id)
				values (${user.id}, -50, 'shop_order', 'shop_order', ${uid()}) returning id`;
			await order(tx, user.id, { ledger_id: entry.id });
			await expectCode(tx, '23505', () => order(tx, user.id, { ledger_id: entry.id }));
			await expectCode(tx, '23503', () => order(tx, user.id, { ledger_id: uid() }));
		});
	});

	it('lines: quantity and price snapshot above zero, options an object or null', async () => {
		await inRollback(async (tx) => {
			const user = await newUser(tx);
			const [o, i] = [await order(tx, user.id), await item(tx)];
			const base = { order_id: o.id, item_id: i.id };
			const row = await line(tx, { ...base, selected_options: tx.json({ size: 'M' }) });
			expect(row).toMatchObject({ quantity: 1, price_points_snapshot: 50 });
			await expectCode(tx, '23514', () => line(tx, { ...base, quantity: 0 }));
			await expectCode(tx, '23502', () => line(tx, { ...base, quantity: null }));
			await expectCode(tx, '23514', () => line(tx, { ...base, price_points_snapshot: 0 }));
			await expectCode(tx, '23502', () => line(tx, { ...base, price_points_snapshot: null }));
			await expectCode(tx, '23514', () => line(tx, { ...base, selected_options: tx.json(['M']) }));
			await expectCode(tx, '23502', () => line(tx, { ...base, item_id: null }));
		});
	});

	it('lines go with their order; an ordered item and a buyer are not hard-deleted', async () => {
		await inRollback(async (tx) => {
			const user = await newUser(tx);
			const [o, i] = [await order(tx, user.id), await item(tx)];
			await line(tx, { order_id: o.id, item_id: i.id });
			await expectCode(tx, '23503', () => tx`delete from shop_items where id = ${i.id}`);
			await expectCode(tx, '23503', () => tx`delete from users where id = ${user.id}`);
			await tx`delete from shop_orders where id = ${o.id}`;
			const left = await tx`select 1 from shop_order_items where order_id = ${o.id}`;
			expect(left).toHaveLength(0);
			await tx`delete from shop_items where id = ${i.id}`;
		});
	});
});
