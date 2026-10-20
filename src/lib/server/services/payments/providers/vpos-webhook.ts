import { createHmac, timingSafeEqual } from 'node:crypto';
import type { WebhookNotice, WebhookRequest } from './types';
import { cleanEvent, fromVposMinor, ourStatus, vposEvent } from './vpos-map';

const SIGNATURE_HEADER = 'x-vpos-signature';
const TOLERANCE_SECONDS = 5 * 60;
const TIMESTAMP = /^\d{10,}$/;
const HEX = /^[0-9a-f]{64}$/;

type WebhookOptions = { secret: string; livemode: boolean; now: Date };

/**
 * `t=<unix>,v1=<hex>[,v1=…]`: HMAC-SHA256 of `<t>.<raw body>`; any `v1` may match (secret
 * rotation); an old or future `t` is a replay.
 */
export function verifySignature(header: string | null, body: string, secret: string, now: Date) {
	if (!header) return false;
	let t = '';
	const candidates: string[] = [];
	for (const part of header.split(',')) {
		const [key, value = ''] = part.trim().split('=');
		if (key === 't') t = value;
		if (key === 'v1') candidates.push(value.toLowerCase());
	}
	if (!TIMESTAMP.test(t)) return false;
	if (Math.abs(now.getTime() / 1000 - Number(t)) > TOLERANCE_SECONDS) return false;
	const expected = createHmac('sha256', secret).update(`${t}.${body}`).digest();
	return candidates.some(
		(candidate) => HEX.test(candidate) && timingSafeEqual(Buffer.from(candidate, 'hex'), expected)
	);
}

/** docs/07 section 6: `null` — wrong signature, not a status event, or the other mode (test / live). */
export function parseVposWebhook(
	{ headers, body }: WebhookRequest,
	{ secret, livemode, now }: WebhookOptions
): WebhookNotice | null {
	if (!verifySignature(headers.get(SIGNATURE_HEADER), body, secret, now)) return null;
	let data: unknown;
	try {
		data = JSON.parse(body);
	} catch {
		return null;
	}
	const parsed = vposEvent.safeParse(data);
	if (!parsed.success || parsed.data.livemode !== livemode) return null;
	const payment = parsed.data.data.payment;
	return {
		eventId: parsed.data.id,
		providerPaymentId: payment.id,
		status: ourStatus(payment),
		amountMinor: fromVposMinor(payment.amountMinor, payment.currency),
		currency: payment.currency,
		raw: cleanEvent(parsed.data)
	};
}
