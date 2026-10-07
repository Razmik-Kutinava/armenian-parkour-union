import { describe, expect, it } from 'vitest';
import { pickLocalized } from './localized';

describe('pickLocalized', () => {
	it('returns the text in the page language', () => {
		expect(pickLocalized({ en: 'Yerevan', ru: 'Ереван' }, 'ru')).toBe('Ереван');
	});

	it('falls back to English when the translation is missing or empty', () => {
		expect(pickLocalized({ en: 'Yerevan', ru: 'Ереван' }, 'hy')).toBe('Yerevan');
		expect(pickLocalized({ en: 'Yerevan', hy: '' }, 'hy')).toBe('Yerevan');
	});
});
