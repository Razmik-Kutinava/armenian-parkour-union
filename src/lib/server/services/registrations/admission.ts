import { ageOn, isMinor } from '#lib/validation/auth.ts';
import type { eventRegistrations } from '../../db/schema/registrations';
import type { users } from '../../db/schema/users';
import { registrationWindow } from '../events/window';

/* docs/03 section 7.2 and 13: the conditions in the order the member should fix them. */

export type RegistrationStatus = (typeof eventRegistrations.$inferSelect)['status'];

export type Refusal =
	| 'already_registered'
	| 'not_open'
	| 'closed'
	| 'blocked'
	| 'email_unverified'
	| 'no_membership'
	| 'category_required'
	| 'category_invalid'
	| 'birth_date_required'
	| 'parental_consent'
	| 'age_mismatch';

export type CategoryAges = { id: string; ageMin: number | null; ageMax: number | null };

export type AdmissionInput = {
	now: Date;
	event: { startsAt: Date; registrationOpensAt: Date | null; registrationClosesAt: Date | null };
	user: {
		status: (typeof users.$inferSelect)['status'];
		emailVerified: boolean;
		birthDate: string | null;
	};
	membershipActive: boolean;
	/** An approved parental consent in force (`hasValidConsent`). */
	parentalConsent: boolean;
	categories: CategoryAges[];
	categoryId: string | null;
	/** The member's row for this event, if any. */
	existing: RegistrationStatus | null;
};

/** Armenia keeps UTC+4 all year: the calendar day of the event in Yerevan. */
export const YEREVAN_OFFSET = 4 * 3_600_000;

function categoryRefusal(i: AdmissionInput): Refusal | null {
	if (i.categories.length > 0 && !i.categoryId) return 'category_required';
	if (i.categoryId && !i.categories.some((c) => c.id === i.categoryId)) return 'category_invalid';
	return null;
}

function ageRefusal(i: AdmissionInput, birthDate: string): Refusal | null {
	if (isMinor(birthDate, i.now) && !i.parentalConsent) return 'parental_consent';
	const category = i.categories.find((c) => c.id === i.categoryId);
	if (!category) return null;
	const age = ageOn(birthDate, new Date(i.event.startsAt.getTime() + YEREVAN_OFFSET));
	if (age === null) return 'age_mismatch';
	if (category.ageMin !== null && age < category.ageMin) return 'age_mismatch';
	if (category.ageMax !== null && age > category.ageMax) return 'age_mismatch';
	return null;
}

/** `null` — admitted. */
export function checkAdmission(i: AdmissionInput): Refusal | null {
	if (i.existing && i.existing !== 'cancelled') return 'already_registered';
	const window = registrationWindow(i.event, i.now).state;
	if (window !== 'open') return window;
	return memberRefusal(i);
}

/** Staff add a member by hand (docs/05 section 5): the registration window and the start do not apply. */
export function checkStaffAdmission(i: AdmissionInput): Refusal | null {
	if (i.existing && i.existing !== 'cancelled') return 'already_registered';
	return memberRefusal(i);
}

function memberRefusal(i: AdmissionInput): Refusal | null {
	if (i.user.status !== 'active') return 'blocked';
	if (!i.user.emailVerified) return 'email_unverified';
	if (!i.membershipActive) return 'no_membership';
	const category = categoryRefusal(i);
	if (category) return category;
	if (!i.user.birthDate) return 'birth_date_required';
	return ageRefusal(i, i.user.birthDate);
}
