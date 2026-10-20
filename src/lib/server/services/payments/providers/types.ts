import type { Locale } from '#lib/i18n/locales.ts';
import type { Currency } from '#lib/money.ts';

/* docs/07 section 4: the rest of the code talks to a bank only through this contract. */

export type ProviderStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';

export type CreatePaymentInput = {
	/** Our `payments.id`. */
	paymentId: string;
	amountMinor: number;
	currency: Currency;
	description: string;
	successUrl: string;
	cancelUrl: string;
	locale: Locale;
	payerEmail?: string;
};

export type CreatePaymentResult = { providerPaymentId: string; checkoutUrl: string; raw: unknown };

export type ProviderPaymentState = {
	status: ProviderStatus;
	amountMinor: number;
	currency: string;
	raw: unknown;
};

/** The incoming request as is: the signature covers the exact body text. */
export type WebhookRequest = { headers: Headers; body: string };

export type WebhookNotice = {
	/** Deduplication key in `payment_webhook_events`. */
	eventId: string;
	providerPaymentId: string;
	/** `pending` — the provider reports a waiting state: recorded, nothing changes. */
	status: ProviderStatus;
	amountMinor: number;
	currency: string;
	raw: unknown;
};

export type RefundResult = { ok: boolean; raw: unknown };

export interface OnlineProvider {
	readonly id: string;
	readonly online: true;
	readonly currencies: readonly Currency[];
	createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
	getStatus(providerPaymentId: string): Promise<ProviderPaymentState>;
	/** `null` — not recognised or the signature is wrong. Only for providers that send webhooks. */
	parseWebhook?(request: WebhookRequest): Promise<WebhookNotice | null>;
	/** Full amount only (docs/07 section 11). Only for providers with refunds over the API. */
	refund?(providerPaymentId: string, amountMinor: number, reason: string): Promise<RefundResult>;
}

/** No redirect and no API: an admin records the payment as already paid (docs/07 section 9). */
export interface OfflineProvider {
	readonly id: string;
	readonly online: false;
	readonly currencies: readonly Currency[];
}

export type PaymentProvider = OnlineProvider | OfflineProvider;

export type ProviderErrorCode =
	'unsupported_currency' | 'invalid_amount' | 'not_found' | 'unreachable' | 'rejected';

export class PaymentProviderError extends Error {
	readonly code: ProviderErrorCode;
	constructor(code: ProviderErrorCode, message: string = code) {
		super(message);
		this.name = 'PaymentProviderError';
		this.code = code;
	}
}

/** `PAYMENT_PROVIDER` names a provider this server must not use. */
export class PaymentConfigError extends Error {
	name = 'PaymentConfigError';
}
