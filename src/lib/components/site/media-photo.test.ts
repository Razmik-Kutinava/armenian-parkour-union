import { describe, expect, it } from 'vitest';
import { mediaPhoto, mediaThumb } from './media-photo';
import { coverOrPlaceholder } from './placeholder-photo';

const KEY = 'media/2026/10/2cd6578a-d82c-4d7e-b33b-a4fb9455ca07.png';
const URL = `https://media.parkour.am/${KEY}`;
const variant = (width: number) =>
	`https://media.parkour.am/cdn-cgi/image/width=${width},fit=scale-down,format=auto/${KEY}`;

describe('mediaPhoto', () => {
	it('a library picture — several widths in WebP or AVIF by Cloudflare, the largest as src', () => {
		expect(mediaPhoto(URL)).toEqual({
			src: variant(1600),
			srcset: [400, 800, 1200, 1600].map((w) => `${variant(w)} ${w}w`).join(', ')
		});
	});

	it('a picture from another host is left as it is', () => {
		const other = `https://example.com/${KEY}`;
		expect(mediaPhoto(other)).toEqual({ src: other });
		expect(mediaPhoto(`https://media.parkour.am.evil.example/${KEY}`).srcset).toBeUndefined();
	});
});

describe('mediaThumb', () => {
	it('one small variant for avatars and thumbnails; another host as it is', () => {
		expect(mediaThumb(URL, 320)).toBe(variant(320));
		expect(mediaThumb('https://example.com/a.png', 320)).toBe('https://example.com/a.png');
	});
});

describe('coverOrPlaceholder', () => {
	it('a cover chosen in the admin panel comes in several sizes', () => {
		expect(coverOrPlaceholder(URL, 'jam')).toEqual(mediaPhoto(URL));
	});
});
