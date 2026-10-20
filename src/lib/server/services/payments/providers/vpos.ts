import type { Currency } from '#lib/money.ts';
import { PaymentProviderError, type OnlineProvider, type ProviderPaymentState } from './types';
import { createVposClient, failure, parsePayment } from './vpos-http';
import { cleanPayment, fromVposMinor, ourStatus, toVposMinor } from './vpos-map';
import { parseVposWebhook } from './vpos-webhook';

export type VposOptions = {
	token: string;
	webhookSecret: string;
	/** `false` — sandbox token: live events are refused, and the other way round. */
	livemode: boolean;
	fetch: typeof globalThis.fetch;
	now?: () => Date;
};

export type VposProvider = OnlineProvider &
	Required<Pick<OnlineProvider, 'parseWebhook' | 'refund'>>;

const REASON_MAX = 240;
/* docs/07 section 13: AMD by default; USD / EUR once the bank confirms them. */
const CURRENCIES: readonly Currency[] = ['AMD'];

/** docs/07 section 4 over the VPOS.am public API v1; the bank behind it is chosen by the token. */
export function createVposProvider(options: VposOptions): VposProvider {
	const { token, webhookSecret, livemode, fetch, now = () => new Date() } = options;
	const { call, fetchPayment } = createVposClient(token, fetch);

	return {
		id: 'vpos',
		online: true,
		currencies: CURRENCIES,

		async createPayment({ paymentId, amountMinor, currency, description, successUrl, ...rest }) {
			if (!CURRENCIES.includes(currency)) throw new PaymentProviderError('unsupported_currency');
			if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
				throw new PaymentProviderError('invalid_amount');
			}
			const { status, data } = await call('/v1/payment-sessions', {
				method: 'POST',
				idempotencyKey: `payment-${paymentId}`,
				body: {
					merchantOrderId: paymentId,
					amountMinor: toVposMinor(amountMinor, currency),
					currency,
					returnUrl: successUrl,
					checkoutLanguage: rest.locale,
					...(rest.payerEmail && { customer: { email: rest.payerEmail } }),
					metadata: { description }
				}
			});
			if (status !== 200 && status !== 201) throw failure(status);
			const payment = parsePayment(data);
			if (payment.merchantOrderId !== paymentId || !payment.checkoutUrl) {
				throw new PaymentProviderError('rejected', 'VPOS session without a checkout page');
			}
			return {
				providerPaymentId: payment.id,
				checkoutUrl: payment.checkoutUrl,
				raw: cleanPayment(payment)
			};
		},

		async getStatus(providerPaymentId): Promise<ProviderPaymentState> {
			const payment = await fetchPayment(providerPaymentId);
			return {
				status: ourStatus(payment),
				amountMinor: fromVposMinor(payment.amountMinor, payment.currency),
				currency: payment.currency,
				raw: cleanPayment(payment)
			};
		},

		async parseWebhook(request) {
			return parseVposWebhook(request, { secret: webhookSecret, livemode, now: now() });
		},

		/* A key per attempt: VPOS keeps a refused refund under its key and would repeat the refusal. */
		async refund(providerPaymentId, amountMinor, reason) {
			const payment = await fetchPayment(providerPaymentId);
			if (fromVposMinor(payment.amountMinor, payment.currency) !== amountMinor) {
				return { ok: false, raw: { refused: 'amount_mismatch', payment: cleanPayment(payment) } };
			}
			const path = `/v1/payments/${encodeURIComponent(providerPaymentId)}/refunds`;
			const { status } = await call(path, {
				method: 'POST',
				idempotencyKey: `refund-${providerPaymentId}-${now().getTime()}`,
				body: {
					amountMinor: payment.amountMinor,
					currency: payment.currency,
					reason: reason.slice(0, REASON_MAX)
				}
			});
			if (status === 200 || status === 202) return { ok: true, raw: { status } };
			if (status === 409 || status === 422 || status === 501) return { ok: false, raw: { status } };
			throw failure(status);
		}
	};
}
