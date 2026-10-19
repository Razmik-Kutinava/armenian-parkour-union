import { eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { insertUser } from '../../db/test-db';
import { paymentWebhookEvents } from '../../db/schema/payments';
import { startOnlinePayment } from './create';
import { createMockProvider, type MockProvider } from './providers/mock';
import type { WebhookRequest } from './providers/types';
import { SITE, membershipPayment, paymentRow } from './test-support';

/* Test support only: a payment started at a mock "bank" that then sends webhooks about it. */

export async function startedAtMock(tx: LimitDb, mock: MockProvider = createMockProvider()) {
	const input = membershipPayment((await insertUser(tx)).id);
	const result = await startOnlinePayment(tx, input, { provider: mock, siteUrl: SITE });
	if (!result.ok) throw new Error(result.reason);
	const row = await paymentRow(tx, result.paymentId);
	return { mock, id: row.id, providerPaymentId: row.providerPaymentId! };
}

/** A fresh `Request` each call: a body can be read only once. */
export function toRequest({ headers, body }: WebhookRequest): Request {
	return new Request(`${SITE}/api/webhooks/mock`, { method: 'POST', headers, body });
}

export const eventIdOf = ({ body }: WebhookRequest): string => JSON.parse(body).eventId;

export async function webhookEvents(tx: LimitDb, eventId: string) {
	return tx.select().from(paymentWebhookEvents).where(eq(paymentWebhookEvents.eventId, eventId));
}

/** Each test gets its own address, so the shared per-IP limit never interferes. */
export const testIp = () => `test-${crypto.randomUUID()}`;
