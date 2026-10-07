import { describe, expect, it } from 'vitest';
import { locales } from './locales';
import { en } from './messages/en';
import { hy } from './messages/hy';
import { ru } from './messages/ru';
import { interpolate, translate, type MessageKey } from './translate';

describe('translate', () => {
	it('returns the text in the requested locale', () => {
		expect(translate('ru', 'common.close')).toBe('Закрыть');
		expect(translate('hy', 'common.close')).toBe('Փակել');
		expect(translate('en', 'common.close')).toBe('Close');
	});

	it('falls back to English when a translation is missing', () => {
		expect(hy['site.name']).toBeUndefined();
		expect(translate('hy', 'site.name')).toBe(en['site.name']);
	});

	it('fills placeholders and keeps unknown ones', () => {
		expect(interpolate('Hello {name}, {points} pts {missing}', { name: 'Arman', points: 20 })).toBe(
			'Hello Arman, 20 pts {missing}'
		);
		expect(interpolate('{toString}', {})).toBe('{toString}');
	});

	it('every locale returns a non-empty string for every key', () => {
		for (const locale of locales) {
			for (const key of Object.keys(en) as MessageKey[]) {
				expect(translate(locale, key).length).toBeGreaterThan(0);
			}
		}
	});

	it('hy and ru contain only known keys', () => {
		const known = new Set(Object.keys(en));
		for (const dict of [hy, ru]) {
			expect(Object.keys(dict).filter((k) => !known.has(k))).toEqual([]);
		}
	});
});
