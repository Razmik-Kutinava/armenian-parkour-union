import { describe, expect, it } from 'vitest';
import { checkAdmission, type AdmissionInput } from './admission';
import { DAY, bornBefore } from './test-support';

/* docs/03 sections 7.2, 13, roadmap 5.10: the edges of the age rules. The category age counts on the
 * event's calendar day in Yerevan; the parental consent — at the moment of registering. */

const NOW = new Date('2026-10-22T12:00:00Z');
const START = new Date(NOW.getTime() + 10 * DAY);
const CAT = '00000000-0000-4000-8000-000000000001';

function input(birthDate: string, over: Partial<AdmissionInput> = {}): AdmissionInput {
	return {
		now: NOW,
		event: { startsAt: START, registrationOpensAt: null, registrationClosesAt: null },
		user: { status: 'active', emailVerified: true, birthDate },
		membershipActive: true,
		parentalConsent: true,
		categories: [],
		categoryId: null,
		existing: null,
		...over
	};
}

const inCategory = (ageMin: number | null, ageMax: number | null, over = {}) => ({
	categories: [{ id: CAT, ageMin, ageMax }],
	categoryId: CAT,
	...over
});

describe('registrations: admission — age edges', () => {
	it('both bounds of a category are inclusive on the event day', () => {
		const range = inCategory(12, 14);
		expect(checkAdmission(input(bornBefore(12, START), range))).toBeNull();
		expect(checkAdmission(input(bornBefore(12, START, -1), range))).toBe('age_mismatch');
		expect(checkAdmission(input(bornBefore(15, START, -1), range))).toBeNull();
		expect(checkAdmission(input(bornBefore(15, START), range))).toBe('age_mismatch');
	});

	it('the birthday on the event day in Yerevan counts, even while it is still the day before in UTC', () => {
		const startsAt = new Date('2026-11-01T21:00:00Z');
		const event = { startsAt, registrationOpensAt: null, registrationClosesAt: null };
		expect(checkAdmission(input('2014-11-02', inCategory(12, null, { event })))).toBeNull();
		expect(checkAdmission(input('2014-11-03', inCategory(12, null, { event })))).toBe(
			'age_mismatch'
		);
	});

	it('17 today and 18 by the event: the consent is still needed when registering', () => {
		const birthDate = bornBefore(18, NOW, -3);
		expect(checkAdmission(input(birthDate, { parentalConsent: false }))).toBe('parental_consent');
		expect(checkAdmission(input(birthDate))).toBeNull();
	});

	it('a minor without a consent is told about the consent first, before the category age', () => {
		const birthDate = bornBefore(10, NOW);
		const adults = inCategory(18, null, { parentalConsent: false });
		expect(checkAdmission(input(birthDate, adults))).toBe('parental_consent');
	});

	it('an adult never needs a consent, in any category', () => {
		const adult = bornBefore(30, NOW);
		expect(checkAdmission(input(adult, inCategory(18, null, { parentalConsent: false })))).toBe(
			null
		);
	});
});
