import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { placeholderPhoto } from './placeholder-photo';

describe('placeholderPhoto', () => {
	it('same key — same photo, and the file exists in static/', () => {
		const keys = ['jam', 'cup-2026', 'news-1', '', 'Ереван'];
		for (const key of keys) {
			const url = placeholderPhoto(key);
			expect(placeholderPhoto(key)).toBe(url);
			expect(existsSync(`static${url}`), url).toBe(true);
		}
	});

	it('different keys spread over all the photos', () => {
		const urls = new Set(Array.from({ length: 30 }, (_, i) => placeholderPhoto(`event-${i}`)));
		expect(urls.size).toBe(3);
	});
});
