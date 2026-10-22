import { describe, expect, it } from 'vitest';
import { checkAdmission, type AdmissionInput } from './admission';
import { DAY, HOUR, bornBefore } from './test-support';

/* docs/03 section 7.2 and 13: who may register; the refusal names the first unmet condition. */

const NOW = new Date('2026-10-22T12:00:00Z');
const START = new Date(NOW.getTime() + 10 * DAY);

function input(over: Partial<AdmissionInput> = {}): AdmissionInput {
	return {
		now: NOW,
		event: { startsAt: START, registrationOpensAt: null, registrationClosesAt: null },
		user: { status: 'active', emailVerified: true, birthDate: '1990-01-01' },
		membershipActive: true,
		parentalConsent: false,
		categories: [],
		categoryId: null,
		existing: null,
		...over
	};
}

const CAT = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';

describe('registrations: admission', () => {
	it('an adult member with a verified email is admitted', () => {
		expect(checkAdmission(input())).toBeNull();
	});

	it('the registration window: not open yet, closed, the event has started', () => {
		const event = input().event;
		expect(
			checkAdmission(input({ event: { ...event, registrationOpensAt: new Date(NOW.getTime() + HOUR) } }))
		).toBe('not_open');
		expect(checkAdmission(input({ event: { ...event, registrationClosesAt: NOW } }))).toBe('closed');
		expect(checkAdmission(input({ event: { ...event, startsAt: NOW } }))).toBe('closed');
	});

	it('blocked, unverified email, no active membership', () => {
		const user = input().user;
		expect(checkAdmission(input({ user: { ...user, status: 'blocked' } }))).toBe('blocked');
		expect(checkAdmission(input({ user: { ...user, emailVerified: false } }))).toBe(
			'email_unverified'
		);
		expect(checkAdmission(input({ membershipActive: false }))).toBe('no_membership');
	});

	it('a live registration blocks a second one; a cancelled one may be renewed', () => {
		for (const existing of ['registered', 'pending_payment', 'waitlist', 'attended', 'no_show'] as const) {
			expect(checkAdmission(input({ existing })), existing).toBe('already_registered');
		}
		expect(checkAdmission(input({ existing: 'cancelled' }))).toBeNull();
	});

	it('already registered wins over a closed window', () => {
		const event = { ...input().event, startsAt: NOW };
		expect(checkAdmission(input({ event, existing: 'registered' }))).toBe('already_registered');
	});

	it('categories: required when the event has them, only its own, none when it has none', () => {
		const categories = [{ id: CAT, ageMin: null, ageMax: null }];
		expect(checkAdmission(input({ categories }))).toBe('category_required');
		expect(checkAdmission(input({ categories, categoryId: OTHER }))).toBe('category_invalid');
		expect(checkAdmission(input({ categoryId: CAT }))).toBe('category_invalid');
		expect(checkAdmission(input({ categories, categoryId: CAT }))).toBeNull();
	});

	it('no birth date — refused: age and consent cannot be checked', () => {
		const user = { ...input().user, birthDate: null };
		expect(checkAdmission(input({ user }))).toBe('birth_date_required');
	});

	it('a minor needs a parental consent in force (docs/03 section 15)', () => {
		const user = { ...input().user, birthDate: bornBefore(15, NOW) };
		expect(checkAdmission(input({ user }))).toBe('parental_consent');
		expect(checkAdmission(input({ user, parentalConsent: true }))).toBeNull();
	});

	it('18 today — no consent needed (docs/03 section 13 p. 4)', () => {
		const user = { ...input().user, birthDate: bornBefore(18, NOW) };
		expect(checkAdmission(input({ user }))).toBeNull();
		const almost = { ...input().user, birthDate: bornBefore(18, NOW, -1) };
		expect(checkAdmission(input({ user: almost }))).toBe('parental_consent');
	});

	it('the category age counts on the event start date', () => {
		const user = { ...input().user, birthDate: bornBefore(12, START) };
		const twelve = [{ id: CAT, ageMin: 12, ageMax: 14 }];
		expect(checkAdmission(input({ user, parentalConsent: true, categories: twelve, categoryId: CAT }))).toBeNull();
		const older = [{ id: CAT, ageMin: 13, ageMax: null }];
		expect(
			checkAdmission(input({ user, parentalConsent: true, categories: older, categoryId: CAT }))
		).toBe('age_mismatch');
		const adult = { ...input().user, birthDate: bornBefore(15, START) };
		const younger = [{ id: CAT, ageMin: null, ageMax: 14 }];
		expect(
			checkAdmission(input({ user: adult, parentalConsent: true, categories: younger, categoryId: CAT }))
		).toBe('age_mismatch');
	});
});
