import type { MessageKey } from '#lib/i18n/translate.ts';

/* docs/07 section 3 p. 7: what the return page says and where it leads, by the status we hold. */

export type PaymentKind = 'membership' | 'donation' | 'event_fee';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';
export type ReturnMode = 'success' | 'cancel';
/** `eventSlug` — the event of an event fee, if it opens on the site. */
export type ReturnPayment = { kind: PaymentKind; status: PaymentStatus; eventSlug?: string | null };

export type PaymentOutcome = {
	title: MessageKey;
	text: MessageKey;
	link: { path: string; label: MessageKey } | null;
};

export const MAX_CHECKS = 5;
export const CHECK_EVERY_MS = 3_000;

/** Where the payment can be started again; an event fee — on the page of its event. */
const retryPath: Record<PaymentKind, string> = {
	membership: '/cabinet/membership',
	donation: '/donate',
	event_fee: '/events'
};

const home = { path: '/', label: 'payment.toHome' } as const;
const retry = ({ kind, eventSlug }: ReturnPayment) => ({
	path: kind === 'event_fee' && eventSlug ? `/events/${eventSlug}` : retryPath[kind],
	label: 'payment.retry' as const
});
const next = (kind: PaymentKind) =>
	kind === 'membership'
		? { path: '/cabinet/membership', label: 'payment.toMembership' as const }
		: home;

export function paymentOutcome(
	payment: ReturnPayment,
	mode: ReturnMode,
	waitedOut: boolean
): PaymentOutcome {
	const { kind, status } = payment;
	switch (status) {
		case 'paid':
			return { title: 'payment.paid.title', text: `payment.paid.${kind}`, link: next(kind) };
		case 'pending':
			if (mode === 'cancel') {
				return {
					title: 'payment.notCompleted.title',
					text: 'payment.notCompleted.text',
					link: retry(payment)
				};
			}
			return waitedOut
				? { title: 'payment.processing.title', text: 'payment.processing.text', link: next(kind) }
				: { title: 'payment.checking.title', text: 'payment.checking.text', link: null };
		case 'refunded':
			return { title: 'payment.refunded.title', text: 'payment.refunded.text', link: home };
		default:
			return {
				title: `payment.${status}.title`,
				text: `payment.${status}.text`,
				link: retry(payment)
			};
	}
}

/** Only a pending payment on the success page is checked again, a few times. */
export function keepChecking({ status }: ReturnPayment, mode: ReturnMode, done: number): boolean {
	return mode === 'success' && status === 'pending' && done < MAX_CHECKS;
}
