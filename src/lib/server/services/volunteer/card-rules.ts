import { isMinor } from '#lib/validation/auth.ts';
import type { users } from '../../db/schema/users';
import type { volunteerCards } from '../../db/schema/volunteer-cards';

/* docs/03 sections 19.1 p. 1 (conditions to apply), 19.2 (validity), 19.1 p. 3 (number). */

export type CardStatus = (typeof volunteerCards.$inferSelect)['status'];
export type CardMissing = 'email' | 'membership' | 'photo' | 'privacy';
export type CardInvalid = 'status' | 'membership' | 'blocked' | 'privacy';
export type CardValidity = { valid: true; until: Date } | { valid: false; reasons: CardInvalid[] };

export type CardFacts = {
	emailVerified: boolean;
	avatarKey: string | null;
	birthDate: string | null;
	status: (typeof users.$inferSelect)['status'];
	/** End of the membership that covers now, a renewal paid ahead included; none — `null`. */
	paidUntil: Date | null;
	/** The `privacy` consent is in force. */
	privacy: boolean;
};

export type ValidityFacts = Pick<CardFacts, 'birthDate' | 'status' | 'paidUntil' | 'privacy'>;

/** Without a birth date — as an adult, as `consents/valid.ts` does. */
const needsPrivacy = (f: Pick<CardFacts, 'birthDate' | 'privacy'>, now: Date) =>
	Boolean(f.birthDate && isMinor(f.birthDate, now)) && !f.privacy;

/** In the order the cabinet shows them; empty — the member may apply. */
export function missingForCard(f: CardFacts, now: Date): CardMissing[] {
	const missing: CardMissing[] = [];
	if (!f.emailVerified) missing.push('email');
	if (!f.paidUntil) missing.push('membership');
	if (!f.avatarKey) missing.push('photo');
	if (needsPrivacy(f, now)) missing.push('privacy');
	return missing;
}

export function cardValidity(status: CardStatus, f: ValidityFacts, now: Date): CardValidity {
	const reasons: CardInvalid[] = [];
	if (status !== 'active') reasons.push('status');
	if (!f.paidUntil) reasons.push('membership');
	if (f.status !== 'active') reasons.push('blocked');
	if (needsPrivacy(f, now)) reasons.push('privacy');
	return reasons.length === 0 && f.paidUntil
		? { valid: true, until: f.paidUntil }
		: { valid: false, reasons };
}

export const formatCardNumber = (year: number, sequence: number) =>
	`APU-V-${year}-${String(sequence).padStart(4, '0')}`;
