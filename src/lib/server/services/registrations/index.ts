import { PUBLIC_SITE_URL } from '$app/env/private';
import type { LimitDb } from '../../auth/rate-limit';
import { sendMail } from '../../mail';
import { cancelRegistration, type CancelResult } from './cancel';
import { registerForEvent, type RegisterInput, type RegisterResult } from './register';
import { registrationSettings } from './settings';

export type { Refusal } from './admission';
export type { CancelResult } from './cancel';
export type { RegisterInput, RegisterResult } from './register';
export { registrationSettings, type RegistrationSettings } from './settings';
export { fillFromWaitlist, sendLetters } from './waitlist';

/** The member registers; the user id comes from the session. */
export async function registerNow(
	db: LimitDb,
	userId: string,
	input: RegisterInput
): Promise<RegisterResult> {
	return registerForEvent(db, userId, input, { settings: await registrationSettings(db) });
}

/** The member cancels their own registration; letters to the waitlist go after the commit. */
export async function cancelNow(
	db: LimitDb,
	userId: string,
	eventId: string
): Promise<CancelResult> {
	return cancelRegistration(db, userId, eventId, {
		settings: await registrationSettings(db),
		send: sendMail,
		siteUrl: PUBLIC_SITE_URL
	});
}
