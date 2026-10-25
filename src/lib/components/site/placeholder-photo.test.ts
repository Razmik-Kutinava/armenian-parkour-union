import { describe, expect, it } from 'vitest';
import { placeholderPhoto } from './placeholder-photo';

describe('placeholderPhoto', () => {
	it('same key — same photo, in a small and a large WebP for phones and screens', () => {
		const keys = ['jam', 'cup-2026', 'news-1', '', 'Ереван'];
		for (const key of keys) {
			const photo = placeholderPhoto(key);
			expect(placeholderPhoto(key)).toEqual(photo);
			const [small, large] = photo.srcset.split(', ');
			expect(small).toMatch(/\.webp 800w$/);
			expect(large).toMatch(/\.webp 1600w$/);
			expect(large.startsWith(`${photo.src} `)).toBe(true);
		}
	});

	it('different keys spread over all the photos', () => {
		const urls = new Set(Array.from({ length: 30 }, (_, i) => placeholderPhoto(`event-${i}`).src));
		expect(urls.size).toBe(3);
	});
});
