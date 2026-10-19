import { describe, expect, it } from 'vitest';
import { pagePath } from './page-path';

/* docs/06 section 3.1: "About" is /federation, "Join" is /join, other pages live under /pages. */
describe('pagePath', () => {
	it('system pages with their own address', () => {
		expect(pagePath('about')).toBe('/federation');
		expect(pagePath('join')).toBe('/join');
	});

	it('any other page is /pages/<slug>', () => {
		expect(pagePath('rules')).toBe('/pages/rules');
		expect(pagePath('summer-camp')).toBe('/pages/summer-camp');
	});
});
