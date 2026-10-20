import { z } from 'zod';
import type { Currency } from '#lib/money.ts';
import type { ProviderStatus } from './types';

/*
 * VPOS.am minor units: AMD under ISO 4217 has two decimals, our AMD has none (lib/money.ts).
 * Open question in docs/questions.md — confirmed by the first sandbox payment.
 */
const FACTOR: Record<Currency, number> = { AMD: 100, USD: 1, EUR: 1 };

export const toVposMinor = (amountMinor: number, currency: Currency) =>
	amountMinor * FACTOR[currency];

/** A remainder gives a fraction, which never matches our integer amount (`apply` flags it). */
export const fromVposMinor = (vposMinor: number, currency: string) =>
	vposMinor / (FACTOR[currency as Currency] ?? 1);

const STATUS = {
	created: 'pending',
	pending_redirect: 'pending',
	pending_payment: 'pending',
	authorized: 'pending',
	status_unknown: 'pending',
	paid: 'paid',
	failed: 'failed',
	cancelled: 'cancelled',
	expired: 'cancelled',
	refunded: 'refunded',
	reversed: 'refunded',
	partially_refunded: 'pending',
	disputed: 'pending'
} as const satisfies Record<string, ProviderStatus>;

type VposStatus = keyof typeof STATUS;
const STATUSES = Object.keys(STATUS) as [VposStatus, ...VposStatus[]];

/* Unknown keys are dropped on parse: customer, metadata and receipts never reach our database. */
export const vposPayment = z.object({
	id: z.string().min(1),
	merchantOrderId: z.string(),
	provider: z.string().optional(),
	amountMinor: z.number().int().nonnegative(),
	currency: z.string().length(3),
	status: z.enum(STATUSES),
	fiscalStatus: z.string().optional(),
	checkoutUrl: z.string().url().optional(),
	createdAt: z.string().optional(),
	updatedAt: z.string().optional()
});

export const vposEvent = z.object({
	id: z.string().min(1),
	type: z.literal('payment.status_changed'),
	livemode: z.boolean(),
	createdAt: z.string().optional(),
	trigger: z.string().optional(),
	data: z.object({ payment: vposPayment })
});

export type VposPayment = z.infer<typeof vposPayment>;
type VposEvent = z.infer<typeof vposEvent>;

/** docs/07 section 11: no partial refunds in the MVP; a dispute is the bank's business — an admin looks. */
export function ourStatus(payment: Pick<VposPayment, 'id' | 'status'>): ProviderStatus {
	if (payment.status === 'partially_refunded' || payment.status === 'disputed') {
		console.warn(`vpos payment ${payment.id}: ${payment.status}, check it in the VPOS console`);
	}
	return STATUS[payment.status];
}

/** docs/07 section 14 p. 2: what goes to `provider_payload` and `payment_webhook_events.payload`. */
export function cleanPayment({ checkoutUrl, ...payment }: VposPayment) {
	void checkoutUrl;
	return payment;
}

export function cleanEvent({ data, ...event }: VposEvent) {
	return { ...event, payment: cleanPayment(data.payment) };
}
