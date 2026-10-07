import { describe, expect, it } from 'vitest';
import { safeReturnTo } from './return-to';

describe('safeReturnTo', () => {
	it('keeps an internal path with query and hash', () => {
		expect(safeReturnTo('/cabinet/points?page=2#top', '/')).toBe('/cabinet/points?page=2#top');
		expect(safeReturnTo('/hy/events', '/')).toBe('/hy/events');
	});

	it('falls back for anything that could leave the site', () => {
		for (const bad of [
			'https://evil.com',
			'//evil.com',
			'/.//evil.com',
			'/a/..//evil.com',
			'/\\evil.com',
			'\\\\evil.com',
			'javascript:alert(1)',
			'evil.com/path',
			'/%0d%0aLocation:evil',
			' /cabinet',
			''
		]) {
			expect(safeReturnTo(bad, '/fallback'), bad).toBe('/fallback');
		}
		expect(safeReturnTo(null, '/fallback')).toBe('/fallback');
	});
});
