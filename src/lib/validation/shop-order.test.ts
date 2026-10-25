import { describe, expect, it } from 'vitest';
import { deliverySchema, optionsFromForm } from './shop-order';

/* docs/06 section 4.7: recipient, phone, city, address, comment; decisions — docs/todo.md 7.6 (9, 10). */

const valid = {
	recipientName: ' Ani Petrosyan ',
	phone: '+374 91 000000',
	city: ' Gyumri ',
	address: 'Rizhkov 5, apt. 3',
	comment: ''
};

const issues = (input: Record<string, unknown>) => {
	const r = deliverySchema.safeParse(input);
	return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
};

describe('delivery form', () => {
	it('trims the values; an empty comment is none', () => {
		expect(deliverySchema.parse(valid)).toEqual({
			recipientName: 'Ani Petrosyan',
			phone: '+374 91 000000',
			city: 'Gyumri',
			address: 'Rizhkov 5, apt. 3',
			comment: null
		});
		expect(deliverySchema.parse({ ...valid, comment: ' Call first ' }).comment).toBe(
			'Call first'
		);
	});

	it('recipient, phone, city and address are required; the phone is checked', () => {
		expect(issues({})).toEqual(
			expect.arrayContaining(['recipientName', 'phone', 'city', 'address'])
		);
		expect(issues({ ...valid, recipientName: '  ', city: '' })).toEqual(['recipientName', 'city']);
		expect(issues({ ...valid, phone: 'call me' })).toEqual(['phone']);
	});

	it('lengths are limited', () => {
		expect(issues({ ...valid, recipientName: 'a'.repeat(101) })).toEqual(['recipientName']);
		expect(issues({ ...valid, city: 'a'.repeat(101) })).toEqual(['city']);
		expect(issues({ ...valid, address: 'a'.repeat(301) })).toEqual(['address']);
		expect(issues({ ...valid, comment: 'a'.repeat(1001) })).toEqual(['comment']);
	});
});

describe('options from the form', () => {
	it('reads `option.{name}` for each option of the item, nothing else', () => {
		const form = new FormData();
		form.set('option.Size', 'M');
		form.set('option.Color', 'Red');
		form.set('option.Fit', 'Slim');
		form.set('Size', 'L');
		expect(optionsFromForm(form, ['Size', 'Color'])).toEqual({ Size: 'M', Color: 'Red' });
	});

	it('a missing option is an empty value, so the service refuses it', () => {
		expect(optionsFromForm(new FormData(), ['Size'])).toEqual({ Size: '' });
		expect(optionsFromForm(new FormData(), [])).toEqual({});
	});
});
