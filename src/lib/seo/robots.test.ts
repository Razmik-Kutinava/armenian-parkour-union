import { describe, expect, it } from 'vitest';
import { renderRobots } from './robots';

describe('seo: robots.txt (docs/06 section 7.2)', () => {
	const text = renderRobots('https://parkour.am/');
	const disallowed = [...text.matchAll(/^Disallow: (.+)$/gm)].map((m) => m[1]);

	it('closes the cabinet, admin, api and certificates, in every language', () => {
		expect(text.startsWith('User-agent: *\n')).toBe(true);
		expect(disallowed.sort()).toEqual(
			[
				'/admin',
				'/api',
				'/cabinet',
				'/certificate',
				'/hy/cabinet',
				'/hy/certificate',
				'/ru/cabinet',
				'/ru/certificate'
			].sort()
		);
	});

	it('points to the sitemap by its absolute address', () => {
		expect(text).toMatch(/^Sitemap: https:\/\/parkour\.am\/sitemap\.xml$/m);
		expect(text.endsWith('\n')).toBe(true);
	});
});
