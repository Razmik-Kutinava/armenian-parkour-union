import { describe, expect, it } from 'vitest';
import { translate } from '#lib/i18n/translate.ts';
import { certificateContent, pdfLanguages, yerevanDate } from './pdf-content';

/* docs/08 section 10: Armenian and English always, Russian by the setting; name, type and level,
 * number, date, the verification address (6.5) without a language prefix. */

const cert = {
	kind: 'level' as const,
	level: 'pro' as const,
	category: null,
	number: 'APU-2026-0007',
	publicToken: 'tok_123',
	issuedAt: new Date('2026-03-05T10:00:00Z'),
	expiresAt: null
};
const holder = { name: 'aram', firstName: 'Արամ', lastName: 'Պետրոսյան' };
const options = {
	languages: pdfLanguages({ pdfRussian: true }),
	unionNames: ['Հայաստանի պարկուրի միություն', 'Armenian Parkour Union', 'Armenian Parkour Union'],
	siteUrl: 'https://parkour.test/'
};

describe('certificates: PDF content', () => {
	it('languages: hy and en always, ru by the setting', () => {
		expect(pdfLanguages({ pdfRussian: true })).toEqual(['hy', 'en', 'ru']);
		expect(pdfLanguages({ pdfRussian: false })).toEqual(['hy', 'en']);
	});

	it('title and type in every language, Armenian first; repeated union names once', () => {
		const c = certificateContent(cert, holder, options);
		expect(c.title).toEqual({
			main: translate('hy', 'certificates.pdf.title'),
			rest: [translate('en', 'certificates.pdf.title'), translate('ru', 'certificates.pdf.title')]
		});
		expect(c.kind).toEqual({
			main: translate('hy', 'certificates.kind.level_pro'),
			rest: [translate('en', 'certificates.kind.level_pro'), translate('ru', 'certificates.kind.level_pro')]
		});
		expect(c.union).toEqual({
			main: 'Հայաստանի պարկուրի միություն',
			rest: ['Armenian Parkour Union']
		});
		const noRu = certificateContent(cert, holder, { ...options, languages: ['hy', 'en'] });
		expect(noRu.kind.rest).toEqual([translate('en', 'certificates.kind.level_pro')]);
	});

	it('holder: first and last name, otherwise the account name', () => {
		expect(certificateContent(cert, holder, options).holder).toBe('Արամ Պետրոսյան');
		const bare = { name: 'Aram P.', firstName: null, lastName: '  ' };
		expect(certificateContent(cert, bare, options).holder).toBe('Aram P.');
	});

	it('fields: number and issue date; level — no expiry, no category', () => {
		const c = certificateContent(cert, holder, options);
		const label = (key: Parameters<typeof translate>[1]) =>
			(['hy', 'en', 'ru'] as const).map((l) => translate(l, key)).join(' / ');
		expect(c.number).toBe('APU-2026-0007');
		expect(c.fields).toEqual([
			{ label: label('certificates.pdf.number'), value: 'APU-2026-0007' },
			{ label: label('certificates.pdf.issued'), value: '05.03.2026' }
		]);
		expect(c.category).toBeNull();
		expect(c.signature).toBe(label('certificates.pdf.signature'));
	});

	it('coach: category and "valid until"', () => {
		const coach = {
			...cert,
			kind: 'trainer' as const,
			level: null,
			category: 'B',
			expiresAt: new Date('2028-03-05T10:00:00Z')
		};
		const c = certificateContent(coach, holder, { ...options, languages: ['hy', 'en'] });
		expect(c.category).toEqual({
			label: `${translate('hy', 'certificates.pdf.category')} / ${translate('en', 'certificates.pdf.category')}`,
			value: 'B'
		});
		expect(c.fields.map((f) => f.value)).toEqual(['APU-2026-0007', '05.03.2026', '05.03.2028']);
	});

	it('verify: absolute address without a language prefix', () => {
		const c = certificateContent(cert, holder, options);
		expect(c.verify.url).toBe('https://parkour.test/certificate/tok_123');
		expect(c.verify.label).toContain(translate('en', 'certificates.pdf.verify'));
	});

	it('dates by Yerevan time', () => {
		expect(yerevanDate(new Date('2026-12-31T21:00:00Z'))).toBe('01.01.2027');
		expect(yerevanDate(new Date('2026-12-31T19:59:00Z'))).toBe('31.12.2026');
	});
});
