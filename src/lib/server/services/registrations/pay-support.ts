import { eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import type { events } from '../../db/schema/events';
import { eventRegistrations } from '../../db/schema/registrations';
import type { Mail } from '../../mail/resend';
import { applyProviderStatus } from '../payments/apply';
import type { MockProvider } from '../payments/providers/mock';
import type { OnlineProvider } from '../payments/providers/types';
import { paymentRow } from '../payments/test-support';
import { startEventPayment, type EventPayDeps } from './pay';
import { eventFeeEffects } from './payment-effects';
import type { RegistrationSettings } from './settings';
import { SETTINGS, SITE, insertEvent, insertMember, mailbox, registerOk } from './test-support';

/* Test support only: paid participation (5.4) inside a rolled-back transaction. */

export const PRICE = 5000;

export const payDeps = (
	provider: OnlineProvider | null,
	extra: Partial<EventPayDeps> = {}
): EventPayDeps => ({ provider, siteUrl: SITE, waitMinutes: 30, ...extra });

export function feeEffects(
	send: (mail: Mail) => Promise<void> = mailbox().send,
	settings: RegistrationSettings = SETTINGS
) {
	return {
		event_fee: eventFeeEffects({ send, siteUrl: SITE, settings: async () => settings })
	};
}

export async function paidEvent(tx: LimitDb, extra: Partial<typeof events.$inferInsert> = {}) {
	return insertEvent(tx, { priceAmountMinor: PRICE, ...extra });
}

/** A member registered for the event and pressed "Pay": pending payment at the provider. */
export async function payStarted(tx: LimitDb, provider: OnlineProvider, eventId: string) {
	const member = await insertMember(tx);
	const { id } = await registerOk(tx, member.id, eventId);
	const started = await startEventPayment(tx, member.id, eventId, 'en', payDeps(provider));
	if (!started.ok) throw new Error(started.reason);
	return { member, registrationId: id, payment: await paymentRow(tx, started.paymentId) };
}

/** The "bank" settles the payment, then the provider path applies it (as a webhook would). */
export async function settleFee(
	tx: LimitDb,
	provider: MockProvider,
	paymentId: string,
	status: 'paid' | 'failed' | 'cancelled' | 'refunded',
	effects: ReturnType<typeof feeEffects>
) {
	const { providerPaymentId } = await paymentRow(tx, paymentId);
	provider.simulate(providerPaymentId!, status);
	const state = await provider.getStatus(providerPaymentId!);
	return applyProviderStatus(
		tx,
		{ provider: provider.id, providerPaymentId: providerPaymentId!, ...state },
		effects
	);
}

export async function expireHold(tx: LimitDb, registrationId: string) {
	await tx
		.update(eventRegistrations)
		.set({ holdUntil: new Date(Date.now() - 60_000) })
		.where(eq(eventRegistrations.id, registrationId));
}
