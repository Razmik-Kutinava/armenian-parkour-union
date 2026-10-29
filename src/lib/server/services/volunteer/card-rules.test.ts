import { describe, expect, it } from 'vitest';
import { cardValidity, formatCardNumber, missingForCard, type CardFacts } from './card-rules';

/* docs/03 sections 19.1 (conditions, number) and 19.2 (validity). */

const NOW = new Date('2026-10-29T12:00:00Z');
const UNTIL = new Date('2027-06-01T00:00:00Z');
const facts = (extra: Partial<CardFacts> = {}): CardFacts => ({
	emailVerified: true,
	avatarKey: 'avatars/u.jpg',
	birthDate: '1990-01-01',
	status: 'active',
	paidUntil: UNTIL,
	privacy: false,
	...extra
});

describe('volunteer card: conditions to apply', () => {
	it('an adult member with a verified email and a photo lacks nothing', () => {
		expect(missingForCard(facts(), NOW)).toEqual([]);
	});

	it('everything missing comes back in the order the cabinet shows it', () => {
		const none = facts({
			emailVerified: false,
			avatarKey: null,
			paidUntil: null,
			birthDate: '2012-05-05'
		});
		expect(missingForCard(none, NOW)).toEqual(['email', 'membership', 'photo', 'privacy']);
	});

	it('a minor needs the privacy consent in force; without a birth date — as an adult', () => {
		expect(missingForCard(facts({ birthDate: '2010-01-01', privacy: true }), NOW)).toEqual([]);
		expect(missingForCard(facts({ birthDate: '2010-01-01' }), NOW)).toEqual(['privacy']);
		expect(missingForCard(facts({ birthDate: '2008-10-29' }), NOW)).toEqual([]);
		expect(missingForCard(facts({ birthDate: null }), NOW)).toEqual([]);
	});
});

describe('volunteer card: validity', () => {
	it('active with a membership: valid until the paid end', () => {
		expect(cardValidity('active', facts(), NOW)).toEqual({ valid: true, until: UNTIL });
	});

	it('every reason it is not, in a fixed order', () => {
		const bad = facts({ status: 'blocked', paidUntil: null, birthDate: '2012-01-01' });
		expect(cardValidity('revoked', bad, NOW)).toEqual({
			valid: false,
			reasons: ['status', 'membership', 'blocked', 'privacy']
		});
		expect(cardValidity('pending', facts(), NOW)).toEqual({ valid: false, reasons: ['status'] });
	});

	it('the photo and the email are conditions to apply, not to stay valid', () => {
		const later = facts({ avatarKey: null, emailVerified: false });
		expect(cardValidity('active', later, NOW)).toEqual({ valid: true, until: UNTIL });
	});
});

describe('volunteer card number', () => {
	it('APU-V-{year}-{four digits}', () => {
		expect(formatCardNumber(2026, 7)).toBe('APU-V-2026-0007');
		expect(formatCardNumber(2027, 12345)).toBe('APU-V-2027-12345');
	});
});
