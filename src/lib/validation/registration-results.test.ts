import { describe, expect, it } from 'vitest';
import { resultRowsSchema } from './registration-results';

/* docs/02 section 3: place — smallint, score — numeric(6,2); empty means "not set". */

const ID = '0b7b2f7e-3b8e-4a7c-9d1e-2f0c4b5a6d7e';
const parse = (place: string, score = '') =>
	resultRowsSchema.safeParse([{ registrationId: ID, place, score }]);

describe('registration results input', () => {
	it('empty — not set; trimmed; a comma works as the decimal point', () => {
		expect(parse('', '').data).toEqual([{ registrationId: ID, place: null, score: null }]);
		expect(parse(' 7 ', ' 12,5 ').data).toEqual([{ registrationId: ID, place: 7, score: '12.50' }]);
		expect(parse('999', '9999.99').data?.[0]).toMatchObject({ place: 999, score: '9999.99' });
		expect(parse('1', '0').data?.[0]).toMatchObject({ place: 1, score: '0.00' });
	});

	it('place 1-999 whole; score 0-9999.99 with up to 2 decimals', () => {
		for (const place of ['0', '1000', '1.5', '-1', 'x', '1e2']) {
			expect(parse(place).success, place).toBe(false);
		}
		for (const score of ['-1', '10000', '1.234', 'abc', '1e3']) {
			expect(parse('', score).success, score).toBe(false);
		}
	});

	it('the registration id is a uuid; at most 2000 rows', () => {
		expect(
			resultRowsSchema.safeParse([{ registrationId: 'x', place: '', score: '' }]).success
		).toBe(false);
		const many = Array.from({ length: 2001 }, () => ({ registrationId: ID, place: '', score: '' }));
		expect(resultRowsSchema.safeParse(many).success).toBe(false);
	});
});
