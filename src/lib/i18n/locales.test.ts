import { describe, expect, it } from 'vitest';
import { defaultLocaleRedirect, isLocale, localeFromPath, localizePath } from './locales';

describe('localeFromPath', () => {
	it.each([
		['/', 'en'],
		['/events', 'en'],
		['/hy', 'hy'],
		['/hy/', 'hy'],
		['/hy/events/open-jam', 'hy'],
		['/ru/news', 'ru'],
		['/hyx', 'en'],
		['/en/events', 'en'],
		['', 'en']
	])('%s -> %s', (path, locale) => {
		expect(localeFromPath(path)).toBe(locale);
	});
});

describe('localizePath', () => {
	it.each([
		['/events', 'hy', '/hy/events'],
		['/', 'ru', '/ru'],
		['/hy/events', 'en', '/events'],
		['/hy', 'en', '/'],
		['/hy/events', 'ru', '/ru/events'],
		['/ru/news', 'ru', '/ru/news'],
		['/events', 'en', '/events']
	] as const)('%s in %s -> %s', (path, locale, expected) => {
		expect(localizePath(path, locale)).toBe(expected);
	});

	it.each([
		['//evil.example/x', 'en', '/evil.example/x'],
		['//evil.example/x', 'ru', '/ru/evil.example/x'],
		['/ru//evil.example', 'en', '/evil.example'],
		['/\\evil.example', 'en', '/evil.example']
	] as const)('never builds an off-site link from %s (%s)', (path, locale, expected) => {
		expect(localizePath(path, locale)).toBe(expected);
	});
});

describe('defaultLocaleRedirect', () => {
	it('sends /en and /en/... to the unprefixed page', () => {
		expect(defaultLocaleRedirect('/en')).toBe('/');
		expect(defaultLocaleRedirect('/en/events')).toBe('/events');
	});

	it('leaves other paths alone', () => {
		expect(defaultLocaleRedirect('/')).toBeNull();
		expect(defaultLocaleRedirect('/english')).toBeNull();
		expect(defaultLocaleRedirect('/hy/en')).toBeNull();
	});
});

describe('isLocale', () => {
	it('accepts only supported codes', () => {
		expect(isLocale('hy')).toBe(true);
		expect(isLocale('de')).toBe(false);
		expect(isLocale(undefined)).toBe(false);
	});
});
