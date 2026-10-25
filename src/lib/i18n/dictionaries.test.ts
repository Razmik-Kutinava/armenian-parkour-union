import { describe, expect, it } from 'vitest';
import { dictionary, loadLocale } from './dictionaries';
import { locales } from './locales';
import { translate } from './translate';

describe('dictionaries', () => {
	it('on the server every language is there without loading: letters and cron jobs', () => {
		expect(dictionary('hy')?.['common.close']).toBe('Փակել');
		expect(dictionary('ru')?.['common.close']).toBe('Закрыть');
		expect(translate('hy', 'common.close')).toBe('Փակել');
	});

	it('loadLocale resolves for every locale, after which its texts are used', async () => {
		for (const locale of locales) await loadLocale(locale);
		expect(translate('ru', 'common.close')).toBe('Закрыть');
		expect(translate('en', 'common.close')).toBe('Close');
	});
});
