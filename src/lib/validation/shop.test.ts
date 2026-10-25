import { describe, expect, it } from 'vitest';
import { itemFormSchema, trackingNoteSchema } from './shop';
import { formToObject } from './site-settings-form';

const BASE = 'https://media.parkour.am';
const schema = itemFormSchema(BASE);
const valid = { slug: 'apu-t-shirt', title: { en: 'T-shirt' }, pricePoints: '150', status: 'draft' };
const errorOf = (input: Record<string, unknown>) =>
	schema.safeParse({ ...valid, ...input }).error?.issues[0];

/* docs/05 section 14; limits — docs/todo.md 7.4, decisions 5–8. */
describe('shop: item form', () => {
	it('slug, title (EN), price and status are required; the rest has defaults', () => {
		expect(schema.parse(valid)).toEqual({
			slug: 'apu-t-shirt',
			title: { en: 'T-shirt' },
			description: {},
			imageKeys: [],
			pricePoints: 150,
			options: null,
			stock: null,
			status: 'draft',
			sortOrder: 0
		});
		for (const key of ['slug', 'title', 'pricePoints', 'status']) {
			expect(schema.safeParse({ ...valid, [key]: undefined }).success, key).toBe(false);
		}
	});

	it('the price is a whole number of points from 1 to 1 000 000', () => {
		for (const bad of ['0', '-5', '1.5', 'abc', '1000001']) {
			expect(errorOf({ pricePoints: bad })?.message, bad).toBe('shop.error.price');
		}
		expect(schema.parse({ ...valid, pricePoints: '1000000' }).pricePoints).toBe(1_000_000);
	});

	it('stock: empty is unlimited, 0 is out of stock, negative or huge is refused', () => {
		expect(schema.parse({ ...valid, stock: '0' }).stock).toBe(0);
		expect(schema.parse({ ...valid, stock: '12' }).stock).toBe(12);
		for (const bad of ['-1', '2.5', '1000001']) {
			expect(errorOf({ stock: bad })?.message, bad).toBe('shop.error.stock');
		}
	});

	it('the form sets draft or published only; archive is a button', () => {
		expect(schema.parse({ ...valid, status: 'published' }).status).toBe('published');
		expect(errorOf({ status: 'archived' })?.path).toEqual(['status']);
	});

	it('images: library keys in the given order, repeats dropped, up to 10', () => {
		const keys = ['media/2026/10/b.webp', 'media/2026/10/a.jpg', 'media/2026/10/b.webp'];
		expect(schema.parse({ ...valid, imageKeys: keys }).imageKeys).toEqual(keys.slice(0, 2));
		expect(errorOf({ imageKeys: ['../secret.jpg'] })?.path).toEqual(['imageKeys', 0]);
		const many = Array.from({ length: 11 }, (_, i) => `media/2026/10/${i}.jpg`);
		expect(errorOf({ imageKeys: many })?.message).toBe('shop.error.images');
	});

	it('options: names with comma lists; repeats and blanks dropped', () => {
		const options = [
			{ name: 'Size', values: 'S, M ,L, M,' },
			{ name: 'Color', values: 'Black' }
		];
		expect(schema.parse({ ...valid, options }).options).toEqual({
			Size: ['S', 'M', 'L'],
			Color: ['Black']
		});
	});

	it('options: a name needs values and values need a name; names do not repeat', () => {
		expect(errorOf({ options: [{ name: 'Size' }] })?.path).toEqual(['options', 0, 'values']);
		expect(errorOf({ options: [{ values: 'S' }] })?.path).toEqual(['options', 0, 'name']);
		const twice = [
			{ name: 'Size', values: 'S' },
			{ name: 'size', values: 'M' }
		];
		expect(errorOf({ options: twice })).toMatchObject({
			path: ['options', 1, 'name'],
			message: 'shop.error.optionRepeat'
		});
	});

	it('options: up to 5 names, 20 values, 40 characters', () => {
		const six = Array.from({ length: 6 }, (_, i) => ({ name: `O${i}`, values: 'A' }));
		expect(errorOf({ options: six })?.message).toBe('shop.error.options');
		const values = Array.from({ length: 21 }, (_, i) => `V${i}`).join(',');
		expect(errorOf({ options: [{ name: 'Size', values }] })?.message).toBe('shop.error.options');
		const long = 'x'.repeat(41);
		expect(errorOf({ options: [{ name: long, values: 'A' }] })?.message).toBe('auth.error.tooLong');
		expect(errorOf({ options: [{ name: 'Size', values: long }] })?.message).toBe(
			'auth.error.tooLong'
		);
	});

	it('the description is cleaned per language and needs EN when another is filled', () => {
		const parsed = schema.parse({
			...valid,
			description: { en: '<p>Cotton<script>alert(1)</script></p>' }
		});
		expect(parsed.description).toEqual({ en: '<p>Cotton</p>' });
		expect(errorOf({ description: { ru: '<p>Хлопок</p>' } })?.path).toEqual(['description', 'en']);
	});

	it('reads the admin form: numbered image and option fields become lists', () => {
		const form = new FormData();
		for (const [k, v] of Object.entries({
			slug: 'cap',
			'title.en': 'Cap',
			pricePoints: '80',
			stock: '',
			status: 'published',
			sortOrder: '3',
			'imageKeys.0': 'media/2026/10/one.jpg',
			'imageKeys.1': 'media/2026/10/two.jpg',
			'options.0.name': 'Size',
			'options.0.values': 'S, M',
			'options.1.name': '',
			'options.1.values': ''
		})) {
			form.set(k, v);
		}
		expect(schema.parse(formToObject(form))).toMatchObject({
			imageKeys: ['media/2026/10/one.jpg', 'media/2026/10/two.jpg'],
			options: { Size: ['S', 'M'] },
			stock: null,
			sortOrder: 3
		});
	});
});

describe('shop: shipping note', () => {
	it('trimmed, up to 500 characters, empty is no note', () => {
		expect(trackingNoteSchema.parse('  RR123456789AM ')).toBe('RR123456789AM');
		expect(trackingNoteSchema.parse('   ')).toBeNull();
		expect(trackingNoteSchema.parse(null)).toBeNull();
		expect(trackingNoteSchema.safeParse('x'.repeat(501)).success).toBe(false);
	});
});
