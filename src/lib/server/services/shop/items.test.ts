import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { ItemValues } from '#lib/validation/shop.ts';
import type { LimitDb } from '../../auth/rate-limit';
import type { UserRole } from '../../auth/session';
import { auditLog, media } from '../../db/schema/service';
import { shopItems, shopOrderItems, shopOrders } from '../../db/schema/shop';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { findUsages } from '../media/usage';
import { getItem, listItems } from './item-list';
import { changeItemStatus, duplicateItem } from './item-status';
import { createItem, updateItem } from './items';

/* docs/05 section 14, docs/03 section 9 item 6; decisions — docs/todo.md 7.4 (4–8, 11). */

const IP = '10.0.0.7';
const LIST = { page: 1, sort: 'sortOrder', dir: 'asc' as const, q: '', filters: {} };

const slug = () => `t-item-${crypto.randomUUID().slice(0, 8)}`;
const values = (s = slug(), extra: Partial<ItemValues> = {}): ItemValues => ({
	slug: s,
	title: { en: `Tee ${s}`, ru: 'Футболка' },
	description: { en: '<p>Cotton</p>' },
	imageKeys: [],
	pricePoints: 150,
	options: { Size: ['S', 'M'] },
	stock: 10,
	status: 'draft',
	sortOrder: 0,
	...extra
});

async function staff(tx: LimitDb, role: UserRole = 'editor') {
	const { id } = await insertUser(tx, { role });
	return { id, role };
}

async function image(tx: LimitDb, owner: string, mime = 'image/png', deleted = false) {
	const key = `media/2026/10/${crypto.randomUUID()}.png`;
	await tx.insert(media).values({
		key,
		originalName: 'tee.png',
		mime,
		sizeBytes: 10,
		uploadedBy: owner,
		deletedAt: deleted ? new Date() : null
	});
	return key;
}

const stored = async (tx: LimitDb, id: string) =>
	(await tx.select().from(shopItems).where(eq(shopItems.id, id)))[0];
const auditOf = (tx: LimitDb, id: string) =>
	tx
		.select()
		.from(auditLog)
		.where(and(eq(auditLog.entityType, 'shop_item'), eq(auditLog.entityId, id)));

async function created(tx: LimitDb, actor: { id: string; role: UserRole }, v: ItemValues) {
	const result = await createItem(tx, actor, v, IP);
	if (typeof result === 'string') throw new Error(result);
	return result.id;
}

describe.skipIf(!testDbUrl)('shop: items in the admin', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('an editor creates an item with images in order; it is logged', async () => {
		await inRollback(async (tx) => {
			const editor = await staff(tx);
			const [a, b] = [await image(tx, editor.id), await image(tx, editor.id)];
			const v = values(slug(), { imageKeys: [b, a] });
			const id = await created(tx, editor, v);
			expect(await stored(tx, id)).toMatchObject({
				slug: v.slug,
				title: v.title,
				description: v.description,
				imageKeys: [b, a],
				pricePoints: 150,
				options: { Size: ['S', 'M'] },
				stock: 10,
				status: 'draft',
				deletedAt: null
			});
			const [entry] = await auditOf(tx, id);
			expect(entry).toMatchObject({ action: 'shop_item.create', actorId: editor.id, ip: IP });
			expect(entry.after).toMatchObject({ slug: v.slug, status: 'draft', pricePoints: 150 });
		});
	});

	it('a moderator or a member may not create or edit items', async () => {
		await inRollback(async (tx) => {
			const editor = await staff(tx);
			const id = await created(tx, editor, values());
			for (const role of ['moderator', 'member'] as const) {
				const actor = await staff(tx, role);
				expect(await createItem(tx, actor, values(), IP)).toBe('not_allowed');
				expect(await updateItem(tx, actor, id, values(), IP)).toBe('not_allowed');
				expect(await changeItemStatus(tx, actor, id, 'publish', IP)).toBe('not_allowed');
				expect(await duplicateItem(tx, actor, id, IP)).toBe('not_allowed');
			}
			expect((await stored(tx, id)).status).toBe('draft');
		});
	});

	it('an address is unique, deleted items included', async () => {
		await inRollback(async (tx) => {
			const editor = await staff(tx);
			const s = slug();
			const first = await created(tx, editor, values(s));
			expect(await createItem(tx, editor, values(s), IP)).toBe('slug_taken');
			const other = await created(tx, editor, values());
			expect(await updateItem(tx, editor, other, values(s), IP)).toBe('slug_taken');
			await tx.update(shopItems).set({ deletedAt: new Date() }).where(eq(shopItems.id, first));
			expect(await createItem(tx, editor, values(s), IP)).toBe('slug_taken');
		});
	});

	it('images must be library images that are not deleted', async () => {
		await inRollback(async (tx) => {
			const editor = await staff(tx);
			const pdf = await image(tx, editor.id, 'application/pdf');
			const gone = await image(tx, editor.id, 'image/png', true);
			const unknown = `media/2026/10/${crypto.randomUUID()}.png`;
			for (const key of [pdf, gone, unknown]) {
				expect(await createItem(tx, editor, values(slug(), { imageKeys: [key] }), IP)).toBe(
					'bad_image'
				);
			}
			const id = await created(tx, editor, values());
			expect(await updateItem(tx, editor, id, values(slug(), { imageKeys: [pdf] }), IP)).toBe(
				'bad_image'
			);
		});
	});

	it('an edit logs the changed fields; a price change leaves old orders as they were', async () => {
		await inRollback(async (tx) => {
			const editor = await staff(tx);
			const v = values();
			const id = await created(tx, editor, v);
			const buyer = await insertUser(tx);
			const [order] = await tx
				.insert(shopOrders)
				.values({
					number: `ORD-2026-${crypto.randomUUID().slice(0, 6)}`,
					userId: buyer.id,
					totalPoints: 150,
					recipientName: 'Ani',
					phone: '+37491000000',
					city: 'Yerevan',
					address: 'Abovyan 1'
				})
				.returning();
			await tx
				.insert(shopOrderItems)
				.values({ orderId: order.id, itemId: id, quantity: 1, pricePointsSnapshot: 150 });

			expect(await updateItem(tx, editor, id, { ...v, pricePoints: 200, stock: null }, IP)).toBe(
				'ok'
			);
			expect(await stored(tx, id)).toMatchObject({ pricePoints: 200, stock: null });
			const [line] = await tx
				.select()
				.from(shopOrderItems)
				.where(eq(shopOrderItems.orderId, order.id));
			expect(line.pricePointsSnapshot).toBe(150);
			const entry = (await auditOf(tx, id)).find((e) => e.action === 'shop_item.update');
			expect(entry?.before).toEqual({ pricePoints: 150, stock: 10 });
			expect(entry?.after).toEqual({ pricePoints: 200, stock: null });
		});
	});

	it('an unchanged save writes nothing; an unknown or deleted item is not found', async () => {
		await inRollback(async (tx) => {
			const editor = await staff(tx);
			const v = values();
			const id = await created(tx, editor, v);
			expect(await updateItem(tx, editor, id, v, IP)).toBe('ok');
			expect((await auditOf(tx, id)).map((e) => e.action)).toEqual(['shop_item.create']);
			expect(await updateItem(tx, editor, crypto.randomUUID(), v, IP)).toBe('not_found');
			expect(await updateItem(tx, editor, 'nope', v, IP)).toBe('not_found');
			await tx.update(shopItems).set({ deletedAt: new Date() }).where(eq(shopItems.id, id));
			expect(await updateItem(tx, editor, id, v, IP)).toBe('not_found');
		});
	});

	it('publish, hide, archive and restore follow the rules and are logged', async () => {
		await inRollback(async (tx) => {
			const editor = await staff(tx);
			const id = await created(tx, editor, values());
			expect(await changeItemStatus(tx, editor, id, 'unpublish', IP)).toBe('bad_status');
			expect(await changeItemStatus(tx, editor, id, 'publish', IP)).toBe('ok');
			expect((await stored(tx, id)).status).toBe('published');
			expect(await changeItemStatus(tx, editor, id, 'unpublish', IP)).toBe('ok');
			expect((await stored(tx, id)).status).toBe('draft');
			expect(await changeItemStatus(tx, editor, id, 'archive', IP)).toBe('ok');
			expect(await changeItemStatus(tx, editor, id, 'publish', IP)).toBe('bad_status');
			expect(await changeItemStatus(tx, editor, id, 'restore', IP)).toBe('ok');
			expect((await stored(tx, id)).status).toBe('draft');
			const updates = (await auditOf(tx, id)).filter((e) => e.action === 'shop_item.update');
			expect(updates.map((e) => (e.after as { status: string }).status)).toEqual([
				'published',
				'draft',
				'archived',
				'draft'
			]);
		});
	});

	it('the form does not take an archived item out of the archive', async () => {
		await inRollback(async (tx) => {
			const editor = await staff(tx);
			const v = values();
			const id = await created(tx, editor, v);
			await changeItemStatus(tx, editor, id, 'archive', IP);
			expect(await updateItem(tx, editor, id, { ...v, status: 'published', stock: 3 }, IP)).toBe(
				'ok'
			);
			expect(await stored(tx, id)).toMatchObject({ status: 'archived', stock: 3 });
		});
	});

	it('a duplicate is a draft copy with a free address; it is logged', async () => {
		await inRollback(async (tx) => {
			const editor = await staff(tx);
			const pic = await image(tx, editor.id);
			const v = values(slug(), { imageKeys: [pic], status: 'published', sortOrder: 4 });
			const id = await created(tx, editor, v);
			const copy = await duplicateItem(tx, editor, id, IP);
			if (typeof copy === 'string') throw new Error(copy);
			expect(await stored(tx, copy.id)).toMatchObject({
				slug: `${v.slug}-copy`,
				title: v.title,
				description: v.description,
				imageKeys: [pic],
				pricePoints: v.pricePoints,
				options: v.options,
				stock: v.stock,
				sortOrder: 4,
				status: 'draft'
			});
			const again = await duplicateItem(tx, editor, id, IP);
			if (typeof again === 'string') throw new Error(again);
			expect((await stored(tx, again.id)).slug).toBe(`${v.slug}-copy-2`);
			const [entry] = await auditOf(tx, copy.id);
			expect(entry).toMatchObject({ action: 'shop_item.create' });
			expect(entry.after).toMatchObject({ duplicatedFrom: id, status: 'draft' });
		});
	});

	it('the list: filters by status and out of stock, search by title, deleted hidden', async () => {
		await inRollback(async (tx) => {
			const editor = await staff(tx);
			const tag = crypto.randomUUID().slice(0, 8);
			const v = (stock: number | null) =>
				values(slug(), { title: { en: `Mug ${tag}` }, stock, status: 'published' });
			const inStock = await created(tx, editor, v(5));
			const out = await created(tx, editor, v(0));
			const draft = await created(tx, editor, { ...v(null), status: 'draft' });
			const gone = await created(tx, editor, v(1));
			await tx.update(shopItems).set({ deletedAt: new Date() }).where(eq(shopItems.id, gone));
			const ids = async (filters: Record<string, string>) =>
				(await listItems(tx, { ...LIST, q: tag, filters })).rows.map((r) => r.id).sort();
			expect(await ids({})).toEqual([inStock, out, draft].sort());
			expect(await ids({ status: 'published' })).toEqual([inStock, out].sort());
			expect(await ids({ stock: 'out' })).toEqual([out]);
			expect(await ids({ status: 'bogus' })).toEqual([inStock, out, draft].sort());
			const { total } = await listItems(tx, { ...LIST, q: tag, filters: {} });
			expect(total).toBe(3);
			expect(await getItem(tx, gone)).toBeNull();
			expect(await getItem(tx, inStock)).toMatchObject({ id: inStock, stock: 5 });
		});
	});

	it('a file used by an item is found; a deleted item does not hold it', async () => {
		await inRollback(async (tx) => {
			const editor = await staff(tx);
			const [pic, inText] = [await image(tx, editor.id), await image(tx, editor.id)];
			const description = { en: `<p><img src="https://media.parkour.am/${inText}" alt=""></p>` };
			const id = await created(tx, editor, values(slug(), { imageKeys: [pic], description }));
			expect(await findUsages(tx, pic)).toEqual([{ kind: 'shop_item', id }]);
			expect(await findUsages(tx, inText)).toEqual([{ kind: 'shop_item', id }]);
			await changeItemStatus(tx, editor, id, 'archive', IP);
			expect(await findUsages(tx, pic)).toEqual([{ kind: 'shop_item', id }]);
			await tx.update(shopItems).set({ deletedAt: new Date() }).where(eq(shopItems.id, id));
			expect(await findUsages(tx, pic)).toEqual([]);
		});
	});
});
