import type { Photo } from './placeholder-photo';

/*
 * Library pictures (R2 behind media.parkour.am) are resized by Cloudflare Image Transformations on
 * the parkour.am zone (sources: this zone only, 5000 variants a month free): `format=auto` — AVIF or
 * WebP by the browser's Accept, `scale-down` — never larger than the original. The host is also in
 * csp.config.ts. Any other host is left as it is.
 */
export const MEDIA = 'https://media.parkour.am/';
const WIDTHS = [400, 800, 1200, 1600];

const resized = (path: string, width: number) =>
	`${MEDIA}cdn-cgi/image/width=${width},fit=scale-down,format=auto/${path}`;

export function mediaPhoto(url: string): Partial<Photo> {
	if (!url.startsWith(MEDIA)) return { src: url };
	const path = url.slice(MEDIA.length);
	return {
		src: resized(path, WIDTHS[WIDTHS.length - 1]),
		srcset: WIDTHS.map((w) => `${resized(path, w)} ${w}w`).join(', ')
	};
}

/** One variant `width` px wide: avatars and thumbnails. */
export const mediaThumb = (url: string, width: number): string =>
	url.startsWith(MEDIA) ? resized(url.slice(MEDIA.length), width) : url;
