/*
 * Temporary stand-in photos (CC0, static/placeholders/CREDITS.txt) until the federation uploads its
 * own (docs/08: real photos). A cover set in the admin panel always wins. One key — one photo.
 */
const PHOTOS = [
	'/placeholders/parkour-1.webp',
	'/placeholders/parkour-2.webp',
	'/placeholders/parkour-3.webp'
];

export function placeholderPhoto(key: string): string {
	let hash = 0;
	for (const ch of key) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0;
	return PHOTOS[hash % PHOTOS.length];
}
