import p1Large from '#lib/assets/placeholders/parkour-1-1600.webp';
import p1Small from '#lib/assets/placeholders/parkour-1-800.webp';
import p2Large from '#lib/assets/placeholders/parkour-2-1600.webp';
import p2Small from '#lib/assets/placeholders/parkour-2-800.webp';
import p3Large from '#lib/assets/placeholders/parkour-3-1600.webp';
import p3Small from '#lib/assets/placeholders/parkour-3-800.webp';

/*
 * Temporary stand-in photos (CC0, lib/assets/placeholders/CREDITS.txt) until the federation uploads
 * its own (docs/08: real photos). A cover set in the admin panel always wins. One key — one photo.
 */
export type Photo = { src: string; srcset: string };

/** Card grids: one column on phones, two from `sm`, three from `lg`. */
export const CARD_SIZES = '(min-width: 64rem) 24rem, (min-width: 40rem) 50vw, 100vw';

const PHOTOS: Photo[] = [
	[p1Small, p1Large],
	[p2Small, p2Large],
	[p3Small, p3Large]
].map(([small, large]) => ({ src: large, srcset: `${small} 800w, ${large} 1600w` }));

export function placeholderPhoto(key: string): Photo {
	let hash = 0;
	for (const ch of key) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0;
	return PHOTOS[hash % PHOTOS.length];
}

/** The picture chosen in the admin panel as it is, or the stand-in for the key. */
export const coverOrPlaceholder = (url: string | null | undefined, key: string): Partial<Photo> =>
	url ? { src: url } : placeholderPhoto(key);
