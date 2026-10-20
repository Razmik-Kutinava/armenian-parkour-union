import { describe, expect, it } from 'vitest';
import { emailChangeSchema, ownProfileSchema, passwordChangeSchema } from './cabinet';

/* docs/06 section 5.2: what the member may edit; birth date is not in the form. */

const base = {
	firstName: ' Narek ',
	lastName: 'Sargsyan',
	phone: '',
	country: 'AM',
	city: '',
	bio: '',
	locale: 'hy'
};

describe('cabinet: own profile form', () => {
	it('trims, blanks become undefined, birth date is ignored', () => {
		const parsed = ownProfileSchema(false).parse({ ...base, birthDate: '2015-01-01' });
		expect(parsed).toEqual({
			firstName: 'Narek',
			lastName: 'Sargsyan',
			phone: undefined,
			country: 'AM',
			city: undefined,
			bio: undefined,
			locale: 'hy',
			guardianName: undefined,
			guardianPhone: undefined,
			guardianEmail: undefined
		});
		expect(parsed).not.toHaveProperty('birthDate');
	});

	it('names are required; phone, country, language and lengths are checked', () => {
		const result = ownProfileSchema(false).safeParse({
			...base,
			firstName: ' ',
			phone: 'call me',
			country: 'Armenia',
			locale: 'de',
			city: 'x'.repeat(101),
			bio: 'x'.repeat(1001)
		});
		expect(result.success).toBe(false);
		const fields = result.error?.issues.map((i) => i.path[0]);
		expect(fields).toEqual(
			expect.arrayContaining(['firstName', 'phone', 'country', 'locale', 'city', 'bio'])
		);
	});

	it('country is an upper-case ISO code from the list', () => {
		expect(ownProfileSchema(false).safeParse({ ...base, country: 'am' }).success).toBe(true);
		expect(ownProfileSchema(false).parse({ ...base, country: 'am' }).country).toBe('AM');
		expect(ownProfileSchema(false).safeParse({ ...base, country: 'XX' }).success).toBe(false);
	});

	it('a minor must give parent data; an adult may leave it empty', () => {
		const minor = ownProfileSchema(true).safeParse(base);
		expect(minor.success).toBe(false);
		expect(minor.error?.issues.map((i) => i.path[0])).toEqual(
			expect.arrayContaining(['guardianName', 'guardianPhone', 'guardianEmail'])
		);
		const filled = ownProfileSchema(true).safeParse({
			...base,
			guardianName: 'Mom',
			guardianPhone: '+37491000000',
			guardianEmail: 'MOM@example.com'
		});
		expect(filled.success).toBe(true);
		expect(filled.data?.guardianEmail).toBe('mom@example.com');
		expect(ownProfileSchema(false).safeParse(base).success).toBe(true);
	});
});

describe('cabinet: email and password forms', () => {
	it('new email is normalised and checked', () => {
		expect(emailChangeSchema.parse({ newEmail: ' New@Example.com ' }).newEmail).toBe(
			'new@example.com'
		);
		expect(emailChangeSchema.safeParse({ newEmail: 'nope' }).success).toBe(false);
	});

	it('password: current is required, new is 8 to 128', () => {
		expect(
			passwordChangeSchema.safeParse({ currentPassword: 'x', newPassword: 'long-enough' }).success
		).toBe(true);
		const bad = passwordChangeSchema.safeParse({ currentPassword: '', newPassword: 'short' });
		expect(bad.error?.issues.map((i) => i.path[0])).toEqual(['currentPassword', 'newPassword']);
	});
});
