import { and, eq, gt, isNotNull, isNull } from 'drizzle-orm';
import { pickLocalized, type LocalizedText } from '#lib/i18n/localized.ts';
import type { Locale } from '#lib/i18n/locales.ts';
import { translate } from '#lib/i18n/translate.ts';
import type { Currency } from '#lib/money.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { events } from '../../db/schema/events';
import { payments } from '../../db/schema/payments';
import { eventRegistrations } from '../../db/schema/registrations';
import { startOnlinePayment, type StartDeps } from '../payments/create';
import { checkoutOf } from '../payments/reuse';
import { isUuid } from '../users/target';
import { readMember } from './admission-data';

/* docs/07 section 5.3 p. 1-2: the member pays for their own held seat; the amount comes from the
 * event (section 3 p. 1). Only the registration row is locked, so the provider call does not hold
 * up the other registrations of the event. */

/** `waitMinutes` — `site_settings.payment_wait_minutes` (`null` — broken). */
export type EventPayDeps = StartDeps & { waitMinutes: number | null };

type Refusal =
	'not_found' | 'not_pending' | 'hold_expired' | 'closed' | 'blocked' | 'unavailable' | 'invalid';

export type EventPayResult =
	| { ok: true; paymentId: string; checkoutUrl: string; reused: boolean }
	| { ok: false; reason: Refusal | 'provider_error' };

const refuse = (reason: Refusal): EventPayResult => ({ ok: false, reason });

type Price = { amountMinor: number; currency: string };

/** The registration's payment if it can still be paid at the same price: pressing again reuses it. */
async function waitingPayment(
	tx: LimitDb,
	paymentId: string | null,
	price: Price,
	providerId: string,
	now: Date
) {
	if (!paymentId) return null;
	const [row] = await tx
		.select({ id: payments.id, payload: payments.providerPayload })
		.from(payments)
		.where(
			and(
				eq(payments.id, paymentId),
				eq(payments.status, 'pending'),
				eq(payments.provider, providerId),
				eq(payments.amountMinor, price.amountMinor),
				eq(payments.currency, price.currency),
				isNotNull(payments.providerPaymentId),
				gt(payments.expiresAt, now)
			)
		);
	const checkoutUrl = checkoutOf(row?.payload);
	return row && checkoutUrl ? { paymentId: row.id, checkoutUrl } : null;
}

export async function startEventPayment(
	db: LimitDb,
	userId: string,
	eventId: string,
	locale: Locale,
	deps: EventPayDeps,
	now = new Date()
): Promise<EventPayResult> {
	if (!isUuid(userId) || !isUuid(eventId)) return refuse('not_found');
	const user = await readMember(db, userId);
	if (!user) return refuse('not_found');
	if (user.status !== 'active') return refuse('blocked');
	const { provider, waitMinutes } = deps;
	if (!provider || !waitMinutes) return refuse('unavailable');
	return db.transaction(async (tx): Promise<EventPayResult> => {
		const [reg] = await tx
			.select()
			.from(eventRegistrations)
			.where(and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.userId, userId)))
			.for('update');
		if (!reg) return refuse('not_found');
		if (reg.status !== 'pending_payment') return refuse('not_pending');
		if (!reg.holdUntil || reg.holdUntil <= now) return refuse('hold_expired');
		const [event] = await tx
			.select()
			.from(events)
			.where(and(eq(events.id, eventId), isNull(events.deletedAt)));
		if (!event) return refuse('not_found');
		if (event.status !== 'published' || event.startsAt <= now) return refuse('closed');
		if (event.priceAmountMinor <= 0) return refuse('unavailable');
		const price = { amountMinor: event.priceAmountMinor, currency: event.priceCurrency };
		const reused = await waitingPayment(tx, reg.paymentId, price, provider.id, now);
		if (reused) return { ok: true, ...reused, reused: true };
		const holdLeft = Math.ceil((reg.holdUntil.getTime() - now.getTime()) / 60_000);
		const title = pickLocalized(event.title as LocalizedText, locale);
		const result = await startOnlinePayment(
			tx,
			{
				kind: 'event_fee',
				userId,
				amountMinor: price.amountMinor,
				currency: price.currency as Currency,
				description: translate(locale, 'registrations.payment.description', { event: title }),
				locale,
				holdMinutes: Math.max(1, Math.min(waitMinutes, holdLeft))
			},
			deps
		);
		if (!result.ok && !result.paymentId) {
			return refuse(result.reason === 'online_off' ? 'unavailable' : 'invalid');
		}
		await tx
			.update(eventRegistrations)
			.set({ paymentId: result.paymentId })
			.where(eq(eventRegistrations.id, reg.id));
		return result.ok ? result : { ok: false, reason: 'provider_error' };
	});
}
