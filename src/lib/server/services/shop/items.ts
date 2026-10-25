import { isDeepStrictEqual } from 'node:util';
import { eq } from 'drizzle-orm';
import type { ItemValues } from '#lib/validation/shop.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { shopItems } from '../../db/schema/shop';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';
import { itemSlugTaken, lockItem, lockItemMedia } from './item-checks';

/* docs/05 section 14; decisions — docs/todo.md 7.4 (4–6). A price change touches no order: lines
 * keep their snapshot (docs/03 section 9 item 6). */

type Refusal = 'not_allowed' | 'not_found' | 'slug_taken' | 'bad_image';

const LOGGED = [
	'slug',
	'title',
	'imageKeys',
	'pricePoints',
	'options',
	'stock',
	'status',
	'sortOrder'
] as const;

export async function createItem(
	db: LimitDb,
	actor: Actor,
	values: ItemValues,
	ip: string | null
): Promise<{ id: string } | Exclude<Refusal, 'not_found'>> {
	if (!roleCan(actor.role, 'shop.items_write')) return 'not_allowed';
	return db.transaction(async (tx) => {
		if (await itemSlugTaken(tx, values.slug)) return 'slug_taken' as const;
		if (!(await lockItemMedia(tx, values.imageKeys, values.description))) {
			return 'bad_image' as const;
		}
		const [row] = await tx.insert(shopItems).values(values).returning({ id: shopItems.id });
		const { slug, title, status, pricePoints, stock } = values;
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'shop_item.create',
			entityType: 'shop_item',
			entityId: row.id,
			after: { slug, title, status, pricePoints, stock },
			ip
		});
		return { id: row.id };
	});
}

/** The form sets draft or published; an archived item stays archived (restore is a button). */
export async function updateItem(
	db: LimitDb,
	actor: Actor,
	id: string,
	values: ItemValues,
	ip: string | null
): Promise<'ok' | Refusal> {
	if (!roleCan(actor.role, 'shop.items_write')) return 'not_allowed';
	if (!isUuid(id)) return 'not_found';
	return db.transaction(async (tx) => {
		const item = await lockItem(tx, id);
		if (!item) return 'not_found' as const;
		if (values.slug !== item.slug && (await itemSlugTaken(tx, values.slug, item.id))) {
			return 'slug_taken' as const;
		}
		const next = { ...values, status: item.status === 'archived' ? item.status : values.status };
		const before: Record<string, unknown> = {};
		const after: Record<string, unknown> = {};
		for (const key of LOGGED) {
			if (isDeepStrictEqual(item[key], next[key])) continue;
			before[key] = item[key];
			after[key] = next[key];
		}
		const descriptionChanged = !isDeepStrictEqual(item.description, next.description);
		if (!descriptionChanged && Object.keys(after).length === 0) return 'ok' as const;
		if (!(await lockItemMedia(tx, next.imageKeys, next.description))) return 'bad_image' as const;
		await tx.update(shopItems).set(next).where(eq(shopItems.id, item.id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'shop_item.update',
			entityType: 'shop_item',
			entityId: item.id,
			before,
			after: descriptionChanged ? { ...after, descriptionChanged: true } : after,
			ip
		});
		return 'ok' as const;
	});
}
