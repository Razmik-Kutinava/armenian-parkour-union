import { PUBLIC_SITE_URL } from '$app/env/private';
import { pickLocalized } from '#lib/i18n/localized.ts';
import type { Locale } from '#lib/i18n/locales.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { sendMail } from '../../mail';
import { listEventCategories } from '../events/categories';
import { onlineProvider, PaymentConfigError } from '../payments/providers';
import { paymentWaitMinutes } from '../payments/settings';
import { cancelRegistration, type CancelResult } from './cancel';
import { startEventPayment, type EventPayResult } from './pay';
import { registerForEvent, type RegisterInput, type RegisterResult } from './register';
import { releaseExpiredHolds } from './release';
import { registrationSettings } from './settings';
import { registrationView, type RegistrationView } from './view';

export type { Refusal } from './admission';
export type { CancelResult } from './cancel';
export type { EventPayResult } from './pay';
export type { RegisterInput, RegisterRefusal, RegisterResult } from './register';
export { eventSlugForPayment } from './return-link';
export { registrationSettings, type RegistrationSettings } from './settings';
export type { ViewRefusal } from './view';
export { fillFromWaitlist, sendLetters } from './waitlist';

/** A new seat on a paid event can be paid online: a provider and the payment wait time are set. */
async function paymentsOnNow(db: LimitDb): Promise<boolean> {
	try {
		return !!(await onlineProvider(db)) && (await paymentWaitMinutes(db)) !== null;
	} catch (e) {
		if (!(e instanceof PaymentConfigError)) throw e;
		console.error('event registration:', e.message);
		return false;
	}
}

type OpenView = Extract<RegistrationView, { state: 'open' }>;
type NamedCategory = OpenView['categories'][number] & { name: string };
/** The block as the page shows it: categories with their names in the page language. */
export type ShownRegistration =
	| Exclude<RegistrationView, OpenView>
	| (Omit<OpenView, 'categories'> & { categories: NamedCategory[] });

/** docs/06 section 4.3: the registration block; `userId` from the session, `null` — a guest. */
export async function registrationViewNow(
	db: LimitDb,
	userId: string | null,
	eventId: string,
	locale: Locale
): Promise<ShownRegistration> {
	const [settings, paymentsOn] = await Promise.all([registrationSettings(db), paymentsOnNow(db)]);
	const view = await registrationView(db, userId, eventId, { settings, paymentsOn });
	if (view.state !== 'open') return view;
	if (view.categories.length === 0) return { ...view, categories: [] };
	const names = new Map(
		(await listEventCategories(db, eventId)).map((c) => [c.id, pickLocalized(c.name, locale)])
	);
	const categories = view.categories.map((c) => ({ ...c, name: names.get(c.id) ?? '' }));
	return { ...view, categories };
}

/** The member registers; the user id comes from the session. */
export async function registerNow(
	db: LimitDb,
	userId: string,
	input: RegisterInput
): Promise<RegisterResult> {
	const [settings, paymentsOn] = await Promise.all([registrationSettings(db), paymentsOnNow(db)]);
	return registerForEvent(db, userId, input, { settings, paymentsOn });
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
