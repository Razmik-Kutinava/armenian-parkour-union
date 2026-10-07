import { describe, expect, it } from 'vitest';
import { isMinor, registerSchema, resetPasswordSchema, signInSchema } from './auth';

const today = new Date('2026-10-07T12:00:00Z');

const adult = {
	email: '  Ani@Example.COM ',
	password: 'parkour-8',
	firstName: 'Ani',
	lastName: 'Petrosyan',
	birthDate: '1990-05-01',
	terms: 'on'
};
const guardian = {
	guardianName: 'Armen Petrosyan',
	guardianPhone: '+374 91 234567',
	guardianEmail: 'armen@example.com'
};

const errorPaths = (input: Record<string, unknown>) => {
	const result = registerSchema(today).safeParse(input);
	return result.success ? [] : result.error.issues.map((i) => i.path.join('.'));
};

describe('isMinor', () => {
	it('is under 18 until the 18th birthday, adult from that day', () => {
		expect(isMinor('2008-10-08', today)).toBe(true);
		expect(isMinor('2008-10-07', today)).toBe(false);
		expect(isMinor('1990-05-01', today)).toBe(false);
	});
});

describe('registerSchema', () => {
	it('accepts an adult without guardian data and lowercases the email', () => {
		const result = registerSchema(today).parse(adult);
		expect(result.email).toBe('ani@example.com');
		expect(result.guardianName).toBeUndefined();
	});

	it('requires guardian name, phone and email for someone under 18', () => {
		const minor = { ...adult, birthDate: '2012-03-15' };
		expect(errorPaths(minor)).toEqual(
			expect.arrayContaining(['guardianName', 'guardianPhone', 'guardianEmail'])
		);
		expect(errorPaths({ ...minor, ...guardian })).toEqual([]);
	});

	it('rejects a missing terms consent', () => {
		expect(errorPaths({ ...adult, terms: undefined })).toContain('terms');
	});

	it('rejects passwords shorter than 8 or longer than 128 characters', () => {
		expect(errorPaths({ ...adult, password: 'short7!' })).toContain('password');
		expect(errorPaths({ ...adult, password: 'x'.repeat(129) })).toContain('password');
		expect(errorPaths({ ...adult, password: 'x'.repeat(128) })).toEqual([]);
	});

	it('rejects a birth date in the future or not a real date', () => {
		expect(errorPaths({ ...adult, birthDate: '2027-01-01' })).toContain('birthDate');
		expect(errorPaths({ ...adult, birthDate: '2000-02-30' })).toContain('birthDate');
		expect(errorPaths({ ...adult, birthDate: '' })).toContain('birthDate');
	});

	it('rejects an invalid email and an invalid guardian phone', () => {
		expect(errorPaths({ ...adult, email: 'not-an-email' })).toContain('email');
		const minor = { ...adult, ...guardian, birthDate: '2012-03-15', guardianPhone: 'call me' };
		expect(errorPaths(minor)).toContain('guardianPhone');
	});
});

describe('signInSchema and resetPasswordSchema', () => {
	it('lowercases the login email and requires a password', () => {
		expect(signInSchema.parse({ email: 'A@B.AM', password: 'x' }).email).toBe('a@b.am');
		expect(signInSchema.safeParse({ email: 'a@b.am', password: '' }).success).toBe(false);
	});

	it('applies the same password length rule to a new password', () => {
		expect(resetPasswordSchema.safeParse({ token: 't', password: 'short' }).success).toBe(false);
		expect(resetPasswordSchema.safeParse({ token: 't', password: 'long-enough' }).success).toBe(
			true
		);
	});
});
