import { pickLocalized } from '#lib/i18n/localized.ts';
import type { Locale } from '#lib/i18n/locales.ts';
import { translate } from '#lib/i18n/translate.ts';
import { yerevanDate } from '../certificates/pdf-content';
import type { CardPdfData } from './card-pdf';

/* docs/03 section 19.8: what the card PDF says, in the language of the page it was downloaded from —
 * kept apart from the drawing. Only these fields: no contacts, no birth date. */

export type CardPdfField = { label: string; value: string };
export type CardPdfContent = {
	title: string;
	union: string;
	holder: string;
	number: CardPdfField;
	validUntil: CardPdfField;
	verify: { label: string; url: string };
	partnersTitle: string;
	empty: string;
	asOf: string;
	partners: {
		name: string;
		logoKey: string | null;
		perks: { title: string; terms: string | null }[];
	}[];
};

export function cardPdfContent(data: CardPdfData, locale: Locale): CardPdfContent {
	const t = (key: Parameters<typeof translate>[1], params?: Record<string, string>) =>
		translate(locale, key, params);
	const partners = data.partners
		.map((p) => ({
			name: p.name,
			logoKey: p.logoKey,
			perks: p.perks
				.filter((perk) => perk.remaining !== 0)
				.map((perk) => ({
					title: pickLocalized(perk.title, locale),
					terms: perk.terms ? pickLocalized(perk.terms, locale) || null : null
				}))
		}))
		.filter((p) => p.perks.length > 0);
	return {
		title: t('volunteerCards.pdf.title'),
		union: t('site.name'),
		holder: data.holder,
		number: { label: t('volunteerCards.pdf.number'), value: data.number },
		validUntil: { label: t('volunteerCards.pdf.validUntil'), value: yerevanDate(data.validUntil) },
		verify: { label: t('volunteerCards.pdf.verify'), url: data.checkUrl },
		partnersTitle: t('volunteerCards.pdf.partners'),
		empty: t('volunteerCards.pdf.empty'),
		asOf: t('volunteerCards.pdf.asOf', { date: yerevanDate(data.asOf) }),
		partners
	};
}
