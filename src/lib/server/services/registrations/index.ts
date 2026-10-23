import { PUBLIC_SITE_URL } from '$app/env/private';
import type { Locale } from '#lib/i18n/locales.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { sendMail } from '../../mail';
import { onlineProvider } from '../payments/providers';
import { paymentWaitMinutes } from '../payments/settings';
import { cancelRegistration, type CancelResult } from './cancel';
import { startEventPayment, type EventPayResult } from './pay';
import { registerForEvent, type RegisterInput, type RegisterResult } from './register';
import { releaseExpiredHolds } from './release';
import { registrationSettings } from './settings';

export type { Refusal } from './admission';
export type { CancelResult } from './cancel';
export type { EventPayResult } from './pay';
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

/** "Pay" for the member's held seat: provider by `PAYMENT_PROVIDER` + `feature_flags`. */
export async function payForEventNow(
	db: LimitDb,
	userId: string,
	eventId: string,
	locale: Locale
): Promise<EventPayResult> {
	return startEventPayment(db, userId, eventId, locale, {
		provider: await onlineProvider(db),
		siteUrl: PUBLIC_SITE_URL,
		waitMinutes: await paymentWaitMinutes(db)
	});
}

/** Unpaid seats whose hold ended go back to the waitlist; run after the payment reconciliation. */
export async function releaseHoldsNow(db: LimitDb): Promise<number> {
	return releaseExpiredHolds(db, {
		settings: await registrationSettings(db),
		send: sendMail,
		siteUrl: PUBLIC_SITE_URL
	});
}
