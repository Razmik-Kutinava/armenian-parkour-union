import { describe, expect, it } from 'vitest';
import { eventFormSchema } from './events';
import { heroFormSchema } from './hero';
import { altSchema } from './media';
import { pageFormSchema } from './pages';
import { postFormSchema } from './posts';

/*
 * 2.9 (decisions.md 2026-10-18): English is the fallback language, so a text filled only in
 * HY / RU would leave the English site empty. Optional texts: empty everywhere or with EN.
 */

const BASE = 'https://media.parkour.am';
const html = '<p>Текст</p>';

const cases = [
	{
		name: 'page text',
		schema: pageFormSchema(BASE),
		valid: { slug: 'summer-camp', title: { en: 'Camp' }, status: 'draft' },
		field: 'body',
		text: html
	},
	{
		name: 'news excerpt',
		schema: postFormSchema(BASE),
		valid: { slug: 'jam-2026', title: { en: 'Jam' }, status: 'draft' },
		field: 'excerpt',
		text: 'Коротко'
	},
	{
		name: 'news text',
		schema: postFormSchema(BASE),
		valid: { slug: 'jam-2026', title: { en: 'Jam' }, status: 'draft' },
		field: 'body',
		text: html
	},
	{
		name: 'event description',
		schema: eventFormSchema(BASE),
		valid: {
			slug: 'open-jam-2026',
			title: { en: 'Open jam' },
			startsAt: '2026-11-14T11:00',
			endsAt: '2026-11-14T18:00',
			price: '0',
			priceCurrency: 'AMD',
			status: 'draft'
		},
		field: 'description',
		text: html
	},
	{
		name: 'hero subtitle',
		schema: heroFormSchema,
		valid: { type: 'presentation', title: { en: 'Join' } },
		field: 'subtitle',
		text: 'Подзаголовок'
	}
] as const;

describe('English is required once another language is filled (2.9)', () => {
	for (const c of cases) {
		it(`${c.name}: HY or RU without EN is refused at the EN field`, () => {
			for (const lang of ['hy', 'ru'] as const) {
				const parsed = c.schema.safeParse({ ...c.valid, [c.field]: { [lang]: c.text } });
				expect(parsed.success).toBe(false);
				expect(parsed.error?.issues.map((i) => i.path)).toContainEqual([c.field, 'en']);
			}
		});

		it(`${c.name}: empty in every language or with EN is fine`, () => {
			expect(c.schema.safeParse(c.valid).success).toBe(true);
			const withEn = { ...c.valid, [c.field]: { en: c.text, ru: c.text } };
			expect(c.schema.safeParse(withEn).success).toBe(true);
		});
	}

	it('media alt: HY or RU without EN is refused; all blank stays allowed (decorative)', () => {
		expect(altSchema.safeParse({ ru: 'Прыжок' }).error?.issues[0].path).toEqual(['en']);
		expect(altSchema.safeParse({ en: '', hy: 'Ցատկ' }).success).toBe(false);
		expect(altSchema.parse({ en: '', hy: '', ru: '' })).toBeNull();
		expect(altSchema.parse({ en: 'Jump', ru: 'Прыжок' })).toEqual({ en: 'Jump', ru: 'Прыжок' });
	});
});
