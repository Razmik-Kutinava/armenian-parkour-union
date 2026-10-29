import { describe, expect, it } from 'vitest';
import { translate } from '#lib/i18n/translate.ts';
import { cardPdfContent } from './card-pdf-content';
import type { CardPdfData } from './card-pdf';
import type { VisiblePerk } from './perks-visible';

/* docs/03 section 19.8: number, name, "valid until", the QR to the Armenian check page, the visible
 * partners, "as of"; one language — the page's, a perk without a translation in English. */

const perk = (extra: Partial<VisiblePerk>): VisiblePerk => ({
	id: crypto.randomUUID(),
	title: { en: '10% off', ru: 'Скидка 10 %' },
	terms: null,
	kind: 'reusable',
	usesLimit: null,
	remaining: null,
	...extra
});

const data = (partners: CardPdfData['partners']): CardPdfData => ({
	number: 'APU-V-2026-0007',
	holder: 'Արամ Պետրոսյան',
	avatarKey: 'avatars/a.webp',
	validUntil: new Date('2027-03-31T20:00:00Z'),
	checkUrl: 'https://parkour.am/hy/volunteer/tok',
	asOf: new Date('2026-10-29T21:30:00Z'),
	partners
});

describe('volunteer card PDF content', () => {
	it('the page language; dates in Yerevan; the check address as given', () => {
		const c = cardPdfContent(data([]), 'ru');
		expect(c.title).toBe(translate('ru', 'volunteerCards.pdf.title'));
		expect(c.holder).toBe('Արամ Պետրոսյան');
		expect(c.number).toEqual({
			label: translate('ru', 'volunteerCards.pdf.number'),
			value: 'APU-V-2026-0007'
		});
		expect(c.validUntil.value).toBe('01.04.2027');
		expect(c.verify.url).toBe('https://parkour.am/hy/volunteer/tok');
		expect(c.asOf).toBe(translate('ru', 'volunteerCards.pdf.asOf', { date: '30.10.2026' }));
		expect(c.partners).toEqual([]);
		expect(c.empty).toBe(translate('ru', 'volunteerCards.pdf.empty'));
	});

	it('perk texts in the language, English where missing; used-up single perks and empty partners dropped', () => {
		const c = cardPdfContent(
			data([
				{
					id: 'p1',
					name: 'Café',
					logoKey: 'media/logo.png',
					perks: [
						perk({ terms: { en: 'Show the QR', hy: 'Ցույց տվեք QR-ը' } }),
						perk({ kind: 'single', usesLimit: 1, remaining: 0 })
					]
				},
				{
					id: 'p2',
					name: 'Gym',
					logoKey: null,
					perks: [perk({ kind: 'single', usesLimit: 2, remaining: 0 })]
				}
			]),
			'hy'
		);
		expect(c.partners).toEqual([
			{
				name: 'Café',
				logoKey: 'media/logo.png',
				perks: [{ title: '10% off', terms: 'Ցույց տվեք QR-ը' }]
			}
		]);
		expect(cardPdfContent(data([]), 'en').title).toBe(translate('en', 'volunteerCards.pdf.title'));
	});

	it('no contacts or birth date can reach the PDF: only these fields', () => {
		expect(Object.keys(cardPdfContent(data([]), 'en')).sort()).toEqual(
			[
				'asOf',
				'empty',
				'holder',
				'number',
				'partners',
				'partnersTitle',
				'title',
				'union',
				'validUntil',
				'verify'
			].sort()
		);
	});
});
