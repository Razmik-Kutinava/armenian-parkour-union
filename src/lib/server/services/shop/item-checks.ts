import { and, eq, inArray, isNull, ne } from 'drizzle-orm';
import { SLUG_MAX } from '#lib/validation/pages.ts';
import type { PostText } from '#lib/validation/posts.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { media } from '../../db/schema/service';
import { shopItems } from '../../db/schema/shop';
import { lockPageMedia } from '../pages/media';

/** Deleted items keep their address too (unique in the table). */
export async function itemSlugTaken(tx: LimitDb, slug: string, exceptId?: string) {
	const [row] = await tx
		.select({ id: shopItems.id })
		.from(shopItems)
		.where(
			exceptId
				? and(eq(shopItems.slug, slug), ne(shopItems.id, exceptId))
				: eq(shopItems.slug, slug)
		);
	return !!row;
}

export async function freeItemCopySlug(tx: LimitDb, slug: string) {
	for (let n = 1; ; n++) {
		const suffix = n === 1 ? '-copy' : `-copy-${n}`;
		const candidate = `${slug.slice(0, SLUG_MAX - suffix.length).replace(/-+$/, '')}${suffix}`;
		if (!(await itemSlugTaken(tx, candidate))) return candidate;
	}
}

export async function lockItem(tx: LimitDb, id: string) {
	const [item] = await tx
		.select()
		.from(shopItems)
		.where(and(eq(shopItems.id, id), isNull(shopItems.deletedAt)))
		.for('update');
	return item;
}

/**
 * docs/05 section 20: photos and text images are locked FOR SHARE, so a parallel delete of the file
 * waits. Every photo must be a library image that is not deleted.
 */
export async function lockItemMedia(tx: LimitDb, imageKeys: string[], description: PostText) {
	await lockPageMedia(tx, description);
	if (imageKeys.length === 0) return true;
	const rows = await tx
		.select({ key: media.key, mime: media.mime })
		.from(media)
		.where(and(inArray(media.key, imageKeys), isNull(media.deletedAt)))
		.for('share');
	const images = new Set(rows.filter((r) => r.mime.startsWith('image/')).map((r) => r.key));
	return imageKeys.every((key) => images.has(key));
}
