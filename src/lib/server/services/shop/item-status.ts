import { eq } from 'drizzle-orm';
import type { PageStatus } from '#lib/validation/pages.ts';
import type { PostText } from '#lib/validation/posts.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { shopItems } from '../../db/schema/shop';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';
import { freeItemCopySlug, lockItem, lockItemMedia } from './item-checks';

/* docs/05 section 14: publish / hide, archive, duplicate; decisions — docs/todo.md 7.4 (5). */

type Missing = 'not_allowed' | 'not_found';
export type ItemStatusAction = 'publish' | 'unpublish' | 'archive' | 'restore';

const RULES: Record<ItemStatusAction, { from: PageStatus[]; to: PageStatus }> = {
	publish: { from: ['draft'], to: 'published' },
	unpublish: { from: ['published'], to: 'draft' },
	archive: { from: ['draft', 'published'], to: 'archived' },
	restore: { from: ['archived'], to: 'draft' }
};

export async function changeItemStatus(
	db: LimitDb,
	actor: Actor,
	id: string,
	action: ItemStatusAction,
	ip: string | null
): Promise<'ok' | 'bad_status' | Missing> {
	const rule = RULES[action];
	if (!rule || !roleCan(actor.role, 'shop.items_write')) return 'not_allowed';
	if (!isUuid(id)) return 'not_found';
	return db.transaction(async (tx) => {
		const item = await lockItem(tx, id);
		if (!item) return 'not_found' as const;
		if (!rule.from.includes(item.status)) return 'bad_status' as const;
		await tx.update(shopItems).set({ status: rule.to }).where(eq(shopItems.id, item.id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'shop_item.update',
			entityType: 'shop_item',
			entityId: item.id,
			before: { status: item.status },
			after: { status: rule.to },
			ip
		});
		return 'ok' as const;
	});
}

/** A draft copy with photos, options, price and stock under a free `…-copy` address. */
export async function duplicateItem(
	db: LimitDb,
	actor: Actor,
	id: string,
	ip: string | null
): Promise<{ id: string } | Missing> {
	if (!roleCan(actor.role, 'shop.items_write')) return 'not_allowed';
	if (!isUuid(id)) return 'not_found';
	return db.transaction(async (tx) => {
		const source = await lockItem(tx, id);
		if (!source) return 'not_found' as const;
		const slug = await freeItemCopySlug(tx, source.slug);
		await lockItemMedia(tx, source.imageKeys, source.description as PostText);
		const { title, description, imageKeys, pricePoints, options, stock, sortOrder } = source;
		const [row] = await tx
			.insert(shopItems)
			.values({
				slug,
				title,
				description,
				imageKeys,
				pricePoints,
				options,
				stock,
				sortOrder,
				status: 'draft'
			})
			.returning({ id: shopItems.id });
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'shop_item.create',
			entityType: 'shop_item',
			entityId: row.id,
			after: { slug, title, status: 'draft', pricePoints, stock, duplicatedFrom: source.id },
			ip
		});
		return { id: row.id };
	});
}
