import { describe, expect, it } from 'vitest';
import { cancelReasonSchema, eventCategorySchema, eventFormSchema } from './events';
import { formToObject } from './site-settings-form';

const BASE = 'https://media.parkour.am';
const schema = eventFormSchema(BASE);
const valid = {
	slug: 'open-jam-2026',
	title: { en: 'Open jam' },
	startsAt: '2026-11-14T11:00',
	endsAt: '2026-11-14T18:00',
	price: '0',
	priceCurrency: 'AMD',
	status: 'draft'
};
const pathOf = (input: Record<string, unknown>) =>
	schema.safeParse({ ...valid, ...input }).error?.issues[0].path;

describe('events: admin form (docs/05 section 5)', () => {
	it('title (EN), address, dates, price and status are required; the rest is optional', () => {
		expect(schema.parse(valid)).toEqual({
			slug: 'open-jam-2026',
			title: { en: 'Open jam' },
			description: {},
			coverKey: null,
			startsAt: new Date('2026-11-14T07:00:00Z'),
			endsAt: new Date('2026-11-14T14:00:00Z'),
			locationName: null,
			address: null,
			city: null,
			latitude: null,
			longitude: null,
			capacity: null,
			priceAmountMinor: 0,
			priceCurrency: 'AMD',
			registrationOpensAt: null,
			registrationClosesAt: null,
			status: 'draft',
			publishedAt: null
		});
		for (const key of ['slug', 'startsAt', 'endsAt', 'price', 'status'] as const) {
			const rest: Record<string, unknown> = { ...valid };
			delete rest[key];
			expect(schema.safeParse(rest).error?.issues[0].path, key).toEqual([key]);
		}
		expect(pathOf({ title: { ru: 'Джем' } })).toEqual(['title', 'en']);
	});

	it('"archive" is not an event address: /events/archive is the archive page', () => {
		expect(pathOf({ slug: 'archive' })).toEqual(['slug']);
		expect(pathOf({ slug: 'Open Jam' })).toEqual(['slug']);
	});

	it('the form status is draft or published; other statuses have their own buttons', () => {
		expect(schema.safeParse({ ...valid, status: 'published' }).success).toBe(true);
		for (const status of ['finished', 'cancelled', 'archived', 'scheduled']) {
			expect(pathOf({ status }), status).toEqual(['status']);
		}
	});

	it('dates are Yerevan time; the end is not before the start', () => {
		expect(pathOf({ startsAt: '2026-13-01T10:00' })).toEqual(['startsAt']);
		expect(pathOf({ endsAt: '2026-11-14T10:59' })).toEqual(['endsAt']);
		expect(schema.safeParse({ ...valid, endsAt: valid.startsAt }).success).toBe(true);
	});

	it('registration window: optional, closing not before opening', () => {
		const ok = schema.parse({
			...valid,
			registrationOpensAt: '2026-11-01T10:00',
			registrationClosesAt: '2026-11-13T22:00'
		});
		expect(ok.registrationOpensAt?.toISOString()).toBe('2026-11-01T06:00:00.000Z');
		expect(ok.registrationClosesAt?.toISOString()).toBe('2026-11-13T18:00:00.000Z');
		expect(
			pathOf({ registrationOpensAt: '2026-11-10T10:00', registrationClosesAt: '2026-11-09T10:00' })
		).toEqual(['registrationClosesAt']);
	});

	it('price is whole drams for AMD and cents for USD / EUR', () => {
		expect(schema.parse({ ...valid, price: '5000' }).priceAmountMinor).toBe(5000);
		expect(schema.parse({ ...valid, price: '12.5', priceCurrency: 'USD' })).toMatchObject({
			priceAmountMinor: 1250,
			priceCurrency: 'USD'
		});
		expect(pathOf({ price: '12.5' })).toEqual(['price']);
		expect(pathOf({ price: '-1' })).toEqual(['price']);
		expect(pathOf({ priceCurrency: 'RUB' })).toEqual(['priceCurrency']);
	});

	it('limit is a whole number from 1, empty means no limit', () => {
		expect(schema.parse({ ...valid, capacity: '40' }).capacity).toBe(40);
		for (const capacity of ['0', '-5', '2.5', 'many']) {
			expect(pathOf({ capacity }), capacity).toEqual(['capacity']);
		}
	});

	it('coordinates: both or none, latitude ±90, longitude ±180, 6 decimals', () => {
		expect(schema.parse({ ...valid, latitude: '40.177200', longitude: '44.503490' })).toMatchObject(
			{ latitude: 40.1772, longitude: 44.50349 }
		);
		expect(pathOf({ latitude: '40.1' })).toEqual(['longitude']);
		expect(pathOf({ longitude: '44.5' })).toEqual(['latitude']);
		expect(pathOf({ latitude: '91', longitude: '44' })).toEqual(['latitude']);
		expect(pathOf({ latitude: '40', longitude: '-181' })).toEqual(['longitude']);
		expect(pathOf({ latitude: '40.1234567', longitude: '44' })).toEqual(['latitude']);
	});

	it('venue, address and city are short plain text', () => {
		const ok = schema.parse({
			...valid,
			locationName: 'Parkour park',
			address: 'Abovyan 1',
			city: 'Yerevan'
		});
		expect(ok).toMatchObject({
			locationName: 'Parkour park',
			address: 'Abovyan 1',
			city: 'Yerevan'
		});
		expect(pathOf({ city: 'x'.repeat(101) })).toEqual(['city']);
	});

	it('description is cleaned per language; the cover is a library key', () => {
		const img = `${BASE}/media/2026/10/${crypto.randomUUID()}.png`;
		const result = schema.parse({
			...valid,
			description: {
				en: `<p onclick="x">Hi<img src="${img}"><img src="https://evil.example/a.png"></p>`
			},
			coverKey: `media/2026/10/${crypto.randomUUID()}.webp`
		});
		expect(result.description.en).toContain(img);
		expect(result.description.en).not.toContain('evil.example');
		expect(result.description.en).not.toContain('onclick');
		expect(pathOf({ coverKey: 'https://evil.example/a.png' })).toEqual(['coverKey']);
	});

	it('reads the form fields as sent by the admin page', () => {
		const form = new FormData();
		form.set('slug', 'jam');
		form.set('title.en', 'Jam');
		form.set('startsAt', '2026-11-14T11:00');
		form.set('endsAt', '2026-11-15T18:00');
		form.set('price', '3000');
		form.set('priceCurrency', 'AMD');
		form.set('capacity', '');
		form.set('city', ' Gyumri ');
		form.set('status', 'published');
		expect(schema.parse(formToObject(form))).toMatchObject({
			slug: 'jam',
			title: { en: 'Jam' },
			priceAmountMinor: 3000,
			capacity: null,
			city: 'Gyumri',
			status: 'published'
		});
	});
});

describe('events: category form (docs/05 section 5, tab "Categories")', () => {
	const category = { name: { en: 'Speed, 12–14' }, discipline: 'speed' };

	it('name (EN) and discipline; ages, limit and order are optional', () => {
		expect(eventCategorySchema.parse(category)).toEqual({
			name: { en: 'Speed, 12–14' },
			discipline: 'speed',
			ageMin: null,
			ageMax: null,
			capacity: null,
			sortOrder: 0
		});
		expect(eventCategorySchema.safeParse({ ...category, discipline: 'parkour' }).success).toBe(
			false
		);
		expect(eventCategorySchema.safeParse({ discipline: 'speed' }).success).toBe(false);
	});

	it('age from 0 to 99, "from" not above "to"; limit from 1', () => {
		expect(
			eventCategorySchema.parse({
				...category,
				ageMin: '12',
				ageMax: '14',
				capacity: '20',
				sortOrder: '2'
			})
		).toMatchObject({ ageMin: 12, ageMax: 14, capacity: 20, sortOrder: 2 });
		const bad = (extra: Record<string, string>) =>
			eventCategorySchema.safeParse({ ...category, ...extra }).error?.issues[0].path;
		expect(bad({ ageMin: '15', ageMax: '14' })).toEqual(['ageMax']);
		expect(bad({ ageMin: '-1' })).toEqual(['ageMin']);
		expect(bad({ ageMax: '100' })).toEqual(['ageMax']);
		expect(bad({ capacity: '0' })).toEqual(['capacity']);
	});
});

describe('events: cancel reason', () => {
	it('is required, up to 500 characters', () => {
		expect(cancelReasonSchema.parse('  Bad weather ')).toBe('Bad weather');
		expect(cancelReasonSchema.safeParse('   ').success).toBe(false);
		expect(cancelReasonSchema.safeParse('x'.repeat(501)).success).toBe(false);
	});
});
