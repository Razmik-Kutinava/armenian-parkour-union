import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { media } from '../../db/schema/service';
import { shopItems } from '../../db/schema/shop';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { getShopItem, listShopItems, SHOP_PAGE_SIZE } from './public';

/* docs/06 section 4.7, docs/03 section 9 item 1; decisions — docs/todo.md 7.5 (1–3). */

const slug = () => `t-shop-${crypto.randomUUID().slice(0, 8)}`;

async function addItem(tx: LimitDb, values: Partial<typeof shopItems.$inferInsert> = {}) {
	const [row] = await tx
		.insert(shopItems)
		.values({
			slug: slug(),
			title: { en: 'Tee', ru: 'Футболка' },
			pricePoints: 150,
			status: 'published',
			sortOrder: -100_000,
			...values
		})
		.returning();
	return row;
}

async function addImage(tx: LimitDb, alt: Record<string, string>, deleted = false) {
	const { id } = await insertUser(tx);
	const key = `media/2026/10/${crypto.randomUUID()}.png`;
	await tx.insert(media).values({
		key,
		originalName: 'tee.png',
		mime: 'image/png',
		sizeBytes: 10,
		alt,
		uploadedBy: id,
		deletedAt: deleted ? new Date() : null
	});
	return key;
}

describe.skipIf(!testDbUrl)('shop: public catalog and item page', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('the catalog lists published items in display order with price, stock mark and cover', async () => {
		await inRollback(async (tx) => {
			const cover = await addImage(tx, { en: 'Black tee', ru: 'Чёрная футболка' });
			const first = await addItem(tx, { sortOrder: -100_002, imageKeys: [cover], stock: 0 });
			const second = await addItem(tx, { sortOrder: -100_001, title: { en: 'Cap' } });
			const hidden = [
				await addItem(tx, { status: 'draft' }),
				await addItem(tx, { status: 'archived' }),
				await addItem(tx, { deletedAt: new Date() })
			];

			const { rows, total } = await listShopItems(tx, { locale: 'ru', page: 1 });
			const slugs = rows.map((r) => r.slug);
			expect(slugs.indexOf(first.slug)).toBe(0);
			expect(slugs.indexOf(second.slug)).toBe(1);
			for (const h of hidden) expect(slugs).not.toContain(h.slug);
			expect(total).toBeGreaterThanOrEqual(2);
			expect(rows[0]).toEqual({
				slug: first.slug,
				title: 'Футболка',
				pricePoints: 150,
				outOfStock: true,
				imageKey: cover,
				imageAlt: 'Чёрная футболка'
			});
			expect(rows[1]).toMatchObject({ title: 'Cap', outOfStock: false, imageKey: null });
		});
	});

	it('the catalog has pages of SHOP_PAGE_SIZE; a deleted cover is not shown', async () => {
		await inRollback(async (tx) => {
			const gone = await addImage(tx, { en: 'Gone' }, true);
			const item = await addItem(tx, { sortOrder: -100_100, imageKeys: [gone] });
			for (let i = 0; i < SHOP_PAGE_SIZE; i++) await addItem(tx, { sortOrder: -100_050 });
			const one = await listShopItems(tx, { locale: 'en', page: 1 });
			expect(one.rows).toHaveLength(SHOP_PAGE_SIZE);
			expect(one.rows[0]).toMatchObject({ slug: item.slug, imageKey: null, imageAlt: '' });
			expect(one.total).toBeGreaterThan(SHOP_PAGE_SIZE);
			const two = await listShopItems(tx, { locale: 'en', page: 2 });
			expect(two.rows.map((r) => r.slug)).not.toContain(item.slug);
		});
	});

	it('the item page has the gallery in order, description, options and price', async () => {
		await inRollback(async (tx) => {
			const a = await addImage(tx, { en: 'Front', ru: 'Спереди' });
			const b = await addImage(tx, { en: 'Back' });
			const gone = await addImage(tx, { en: 'Gone' }, true);
			const item = await addItem(tx, {
				imageKeys: [b, gone, a],
				description: { en: '<p>Cotton</p>', ru: '<p>Хлопок</p>' },
				options: { Size: ['S', 'M'], Color: ['Black'] },
				stock: 3
			});

			const shown = await getShopItem(tx, item.slug, 'ru');
			expect(shown).toEqual({
				id: item.id,
				slug: item.slug,
				title: 'Футболка',
				pricePoints: 150,
				outOfStock: false,
				imageKey: b,
				imageAlt: 'Back',
				images: [
					{ key: b, alt: 'Back' },
					{ key: a, alt: 'Спереди' }
				],
				html: '<p>Хлопок</p>',
				options: [
					{ name: 'Size', values: ['S', 'M'] },
					{ name: 'Color', values: ['Black'] }
				],
				updatedAt: item.updatedAt
			});
			expect((await getShopItem(tx, item.slug, 'hy'))?.html).toBe('<p>Cotton</p>');
		});
	});

	it('a draft, archived, deleted or unknown item has no page', async () => {
		await inRollback(async (tx) => {
			for (const values of [
				{ status: 'draft' as const },
				{ status: 'archived' as const },
				{ deletedAt: new Date() }
			]) {
				const item = await addItem(tx, values);
				expect(await getShopItem(tx, item.slug, 'en')).toBeNull();
			}
			expect(await getShopItem(tx, slug(), 'en')).toBeNull();
		});
	});
});
