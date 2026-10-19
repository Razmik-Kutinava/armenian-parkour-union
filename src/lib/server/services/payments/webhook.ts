import { and, eq } from 'drizzle-orm';
import { consume, limits, type LimitDb, type LimitRule } from '../../auth/rate-limit';
import { paymentWebhookEvents } from '../../db/schema/payments';
import { applyProviderStatus, type ApplyResult } from './apply';
import { paymentEffects, type PaymentEffects } from './effects';
import type { PaymentProvider, WebhookNotice } from './providers/types';
import { readBody } from './webhook-body';

export type WebhookOptions = {
	ip: string;
	effects?: PaymentEffects;
	limit?: LimitRule;
	maxBytes?: number;
};

const MAX_BODY_BYTES = 64 * 1024;

/** What lands in `payment_webhook_events.error` once the event is handled. */
const eventError: Record<ApplyResult, string | null> = {
	applied: null,
	unchanged: null,
	not_found: 'payment_not_found',
	mismatch: 'amount_mismatch',
	ignored: 'transition_ignored'
};

/**
 * docs/07 section 6: signature → record the event → apply the status. Returns the HTTP status for
 * the provider: 200 once the event is handled (even if the payment is unknown), 500 to make it retry.
 */
export async function receiveWebhook(
	db: LimitDb,
	provider: PaymentProvider | null,
	request: Request,
	{
		ip,
		effects = paymentEffects,
		limit = limits.webhookPerIp,
		maxBytes = MAX_BODY_BYTES
	}: WebhookOptions
): Promise<number> {
	if (!provider?.online || !provider.parseWebhook) return 404;
	if (!(await consume(db, `webhook:ip:${ip}`, limit))) return 429;
	const body = await readBody(request, maxBytes);
	if (body === null) return 413;
	const notice = await provider.parseWebhook({ headers: request.headers, body }).catch(() => null);
	if (!notice) {
		console.warn(`webhook ${provider.id}: rejected (signature or format)`);
		return 400;
	}
	const eventId = await recordEvent(db, provider.id, notice);
	if (!eventId) return 200;
	try {
		const result = await applyProviderStatus(db, { provider: provider.id, ...notice }, effects);
		await markEvent(db, eventId, { processedAt: new Date(), error: eventError[result] });
		return 200;
	} catch (e) {
		console.error(`webhook ${provider.id} ${notice.eventId}: processing failed`, e);
		const message = e instanceof Error ? e.message : String(e);
		await markEvent(db, eventId, { error: message.slice(0, 500) });
		return 500;
	}
}

/** Id of the event still to process; `null` — a duplicate of one already processed. */
async function recordEvent(db: LimitDb, provider: string, notice: WebhookNotice) {
	const [inserted] = await db
		.insert(paymentWebhookEvents)
		.values({ provider, eventId: notice.eventId, payload: notice.raw ?? {} })
		.onConflictDoNothing()
		.returning({ id: paymentWebhookEvents.id });
	if (inserted) return inserted.id;
	const [known] = await db
		.select({ id: paymentWebhookEvents.id, processedAt: paymentWebhookEvents.processedAt })
		.from(paymentWebhookEvents)
		.where(
			and(
				eq(paymentWebhookEvents.provider, provider),
				eq(paymentWebhookEvents.eventId, notice.eventId)
			)
		);
	return known && !known.processedAt ? known.id : null;
}

async function markEvent(
	db: LimitDb,
	id: string,
	set: { processedAt?: Date; error: string | null }
) {
	await db.update(paymentWebhookEvents).set(set).where(eq(paymentWebhookEvents.id, id));
}
