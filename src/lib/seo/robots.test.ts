import { describe, expect, it } from 'vitest';
import { renderRobots } from './robots';

describe('seo: robots.txt (docs/06 section 7.2)', () => {
	const text = renderRobots('https://parkour.am/');
	const disallowed = [...text.matchAll(/^Disallow: (.+)$/gm)].map((m) => m[1]);

	it('closes the cabinet, admin, api, certificates, volunteer cards and cashier pages, in every language', () => {
		expect(text.startsWith('User-agent: *\n')).toBe(true);
		expect(disallowed.sort()).toEqual(
			[
				'/admin',
				'/api',
				'/cabinet',
				'/certificate',
				'/volunteer',
				'/partner',
				'/hy/cabinet',
				'/hy/certificate',
				'/hy/volunteer',
				'/hy/partner',
				'/ru/cabinet',
				'/ru/certificate',
				'/ru/volunteer',
				'/ru/partner'
			].sort()
		);
	});

	it('points to the sitemap by its absolute address', () => {
		expect(text).toMatch(/^Sitemap: https:\/\/parkour\.am\/sitemap\.xml$/m);
		expect(text.endsWith('\n')).toBe(true);
	});
});
