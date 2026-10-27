import { describe, expect, it } from 'vitest';
import { pickPortal } from './localized';

/* Portal texts: page language → ru → en (docs/02 section 11, decisions 2026-10-27). */
describe('pickPortal', () => {
	it('the page language first, then Russian, then English', () => {
		expect(pickPortal({ en: 'Rules', ru: 'Правила', hy: 'Կանոններ' }, 'hy')).toBe('Կանոններ');
		expect(pickPortal({ en: 'Rules', ru: 'Правила' }, 'hy')).toBe('Правила');
		expect(pickPortal({ en: 'Rules' }, 'ru')).toBe('Rules');
		expect(pickPortal({ hy: 'Կանոններ' }, 'en')).toBe('Կանոններ');
	});

	it('nothing filled — an empty string', () => {
		expect(pickPortal({}, 'en')).toBe('');
		expect(pickPortal(null, 'ru')).toBe('');
	});
});
