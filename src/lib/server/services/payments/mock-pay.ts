import { and, eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { payments } from '../../db/schema/payments';
import type { MockProvider } from './providers/mock';
import { PaymentProviderError, type PaymentProvider } from './providers/types';
import { receiveWebhook, type WebhookOptions } from './webhook';

/* docs/07 section 4: the mock "bank" page, development only (the route is 404 elsewhere and
 * `providerById('mock')` is null outside dev). The result goes the webhook way, as a bank would. */

const OUTCOMES = ['paid', 'failed', 'cancelled'] as const;
type Outcome = (typeof OUTCOMES)[number];

export type MockCheckout = Pick<
	typeof payments.$inferSelect,
	'id' | 'kind' | 'status' | 'amountMinor' | 'currency'
>;

export type MockSettle = 'done' | 'not_found' | 'invalid' | 'failed';

export async function getMockCheckout(
	db: LimitDb,
	providerPaymentId: string
): Promise<MockCheckout | null> {
	const [row] = await db
		.select({
			id: payments.id,
			kind: payments.kind,
			status: payments.status,
			amountMinor: payments.amountMinor,
			currency: payments.currency
		})
		.from(payments)
		.where(and(eq(payments.provider, 'mock'), eq(payments.providerPaymentId, providerPaymentId)));
	return row ?? null;
}

const isMock = (provider: PaymentProvider | null): provider is MockProvider =>
	provider?.id === 'mock' && 'simulate' in provider;

const isOutcome = (status: string): status is Outcome =>
	(OUTCOMES as readonly string[]).includes(status);

export async function settleMockPayment(
	db: LimitDb,
	provider: PaymentProvider | null,
	providerPaymentId: string,
	status: string,
	options: WebhookOptions
): Promise<MockSettle> {
	if (!isOutcome(status)) return 'invalid';
	if (!isMock(provider)) return 'not_found';
	let notice;
	try {
		notice = provider.simulate(providerPaymentId, status);
	} catch (e) {
		if (e instanceof PaymentProviderError) return 'not_found';
		throw e;
	}
	const request = new Request('http://mock.local/api/webhooks/mock', {
		method: 'POST',
		headers: notice.headers,
		body: notice.body
	});
	return (await receiveWebhook(db, provider, request, options)) === 200 ? 'done' : 'failed';
}
