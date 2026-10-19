import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { CURRENCIES } from '#lib/money.ts';
import {
	PaymentProviderError,
	type OnlineProvider,
	type ProviderStatus,
	type WebhookRequest
} from './types';

const SIGNATURE_HEADER = 'x-mock-signature';
const SIGNATURE = /^[0-9a-f]{64}$/;

const noticeSchema = z
	.object({
		eventId: z.string().min(1),
		providerPaymentId: z.string().min(1),
		status: z.enum(['paid', 'failed', 'cancelled', 'refunded']),
		amountMinor: z.number().int(),
		currency: z.string().length(3)
	})
	.strict();

type Stored = { status: ProviderStatus; amountMinor: number; currency: string };
type Override = { amountMinor?: number; currency?: string };

export type MockProvider = OnlineProvider &
	Required<Pick<OnlineProvider, 'parseWebhook' | 'refund'>> & {
		/** The "bank" settles the payment and sends a signed webhook about it. */
		simulate(
			providerPaymentId: string,
			status: Exclude<ProviderStatus, 'pending'>,
			override?: Override
		): WebhookRequest;
	};

/**
 * docs/07 section 4: a bank imitation for development and tests. State lives in this process only;
 * the default secret is random per process, so a webhook can only come from this instance.
 */
export function createMockProvider(options: { secret?: string } = {}): MockProvider {
	const secret = options.secret ?? randomBytes(32).toString('hex');
	const payments = new Map<string, Stored>();
	const sign = (body: string) => createHmac('sha256', secret).update(body).digest();

	function find(providerPaymentId: string): Stored {
		const payment = payments.get(providerPaymentId);
		if (!payment) throw new PaymentProviderError('not_found');
		return payment;
	}

	function signed({ headers, body }: WebhookRequest): boolean {
		const given = headers.get(SIGNATURE_HEADER)?.toLowerCase() ?? '';
		return SIGNATURE.test(given) && timingSafeEqual(Buffer.from(given, 'hex'), sign(body));
	}

	return {
		id: 'mock',
		online: true,
		currencies: CURRENCIES,

		async createPayment({ paymentId, amountMinor, currency, successUrl }) {
			if (!CURRENCIES.includes(currency)) throw new PaymentProviderError('unsupported_currency');
			if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
				throw new PaymentProviderError('invalid_amount');
			}
			const providerPaymentId = `mock_${randomUUID()}`;
			payments.set(providerPaymentId, { status: 'pending', amountMinor, currency });
			return {
				providerPaymentId,
				checkoutUrl: `${new URL(successUrl).origin}/dev/mock-pay/${providerPaymentId}`,
				raw: { providerPaymentId, paymentId }
			};
		},

		async getStatus(providerPaymentId) {
			const payment = find(providerPaymentId);
			return { ...payment, raw: { providerPaymentId, ...payment } };
		},

		async parseWebhook(request) {
			if (!signed(request)) return null;
			let data: unknown;
			try {
				data = JSON.parse(request.body);
			} catch {
				return null;
			}
			const notice = noticeSchema.safeParse(data);
			return notice.success ? { ...notice.data, raw: data } : null;
		},

		async refund(providerPaymentId, amountMinor) {
			const payment = find(providerPaymentId);
			if (payment.status !== 'paid' || amountMinor !== payment.amountMinor) {
				return { ok: false, raw: { status: payment.status } };
			}
			payment.status = 'refunded';
			return { ok: true, raw: { status: payment.status } };
		},

		simulate(providerPaymentId, status, override = {}) {
			const payment = find(providerPaymentId);
			payment.status = status;
			const body = JSON.stringify({
				eventId: `evt_${randomUUID()}`,
				providerPaymentId,
				status,
				amountMinor: override.amountMinor ?? payment.amountMinor,
				currency: override.currency ?? payment.currency
			});
			const headers = new Headers({
				'content-type': 'application/json',
				[SIGNATURE_HEADER]: sign(body).toString('hex')
			});
			return { headers, body };
		}
	};
}
