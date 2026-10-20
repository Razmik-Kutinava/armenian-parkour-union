import { createHmac } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import type { LimitDb } from '../../auth/rate-limit';
import { countingEffects } from './apply-support';
import { startOnlinePayment } from './create';
import { createVposProvider } from './providers/vpos';
import { SITE, membershipPayment, paymentRow } from './test-support';
import { receiveWebhook } from './webhook';
import { testIp, webhookEvents } from './webhook-support';

/* docs/07 sections 3, 6: a VPOS.am payment through our service and webhook, the bank faked. */

const SECRET = 'whsec_chain';

/** VPOS answers a session for whatever order it was asked about. */
const fetch = (async (_url: string | URL, init: RequestInit = {}) => {
	const asked = JSON.parse(String(init.body));
	const session = {
		id: `pay_${crypto.randomUUID()}`,
		merchantOrderId: asked.merchantOrderId,
		provider: 'ameriabank_vpos',
		amountMinor: asked.amountMinor,
		currency: asked.currency,
		status: 'pending_redirect',
		fiscalStatus: 'not_required',
		checkoutUrl: 'https://checkout.vpos.am/s/chain'
	};
	return new Response(JSON.stringify(session), { status: 201 });
}) as typeof globalThis.fetch;

const vpos = createVposProvider({ token: 't', webhookSecret: SECRET, livemode: false, fetch });

async function started(tx: LimitDb) {
	const input = membershipPayment((await insertUser(tx)).id);
	const result = await startOnlinePayment(tx, input, { provider: vpos, siteUrl: SITE });
	if (!result.ok) throw new Error(result.reason);
	return paymentRow(tx, result.paymentId);
}

function webhook(providerPaymentId: string, status: string, amountMinor: number) {
	const eventId = `evt_${crypto.randomUUID()}`;
	const body = JSON.stringify({
		id: eventId,
		type: 'payment.status_changed',
		livemode: false,
		createdAt: new Date().toISOString(),
		data: {
			payment: {
				id: providerPaymentId,
				merchantOrderId: 'ours',
				provider: 'ameriabank_vpos',
				amountMinor,
				currency: 'AMD',
				status,
				fiscalStatus: 'not_required',
				customer: { email: 'member@example.com' }
			}
		}
	});
	const t = Math.floor(Date.now() / 1000);
	const v1 = createHmac('sha256', SECRET).update(`${t}.${body}`).digest('hex');
	const headers = { 'content-type': 'application/json', 'x-vpos-signature': `t=${t},v1=${v1}` };
	const request = new Request(`${SITE}/api/webhooks/vpos`, { method: 'POST', headers, body });
	return { eventId, request };
}

describe.skipIf(!testDbUrl)('payments: VPOS.am chain', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a waiting event is recorded with 200 and changes nothing; paid then applies once', async () => {
		await inRollback(async (tx) => {
			const row = await started(tx);
			expect(row).toMatchObject({ provider: 'vpos', status: 'pending' });
			const vposAmount = row.amountMinor * 100;
			const { calls, effects } = countingEffects();

			const waiting = webhook(row.providerPaymentId!, 'pending_payment', vposAmount);
			const opts = { ip: testIp(), effects };
			expect(await receiveWebhook(tx, vpos, waiting.request, opts)).toBe(200);
			expect((await paymentRow(tx, row.id)).status).toBe('pending');
			const [event] = await webhookEvents(tx, waiting.eventId);
			expect(event).toMatchObject({ provider: 'vpos', error: null });
			expect(JSON.stringify(event.payload)).not.toContain('member@example.com');

			const paid = webhook(row.providerPaymentId!, 'paid', vposAmount);
			expect(await receiveWebhook(tx, vpos, paid.request, { ip: testIp(), effects })).toBe(200);
			expect((await paymentRow(tx, row.id)).status).toBe('paid');
			expect(calls).toEqual(['paid:paid']);
		});
	});

	it('paid with our amount in drams instead of VPOS units is a mismatch, not paid', async () => {
		await inRollback(async (tx) => {
			const row = await started(tx);
			const { calls, effects } = countingEffects();
			const paid = webhook(row.providerPaymentId!, 'paid', row.amountMinor);
			expect(await receiveWebhook(tx, vpos, paid.request, { ip: testIp(), effects })).toBe(200);
			expect(await paymentRow(tx, row.id)).toMatchObject({ status: 'failed', needsReview: true });
			expect(calls).toEqual([]);
		});
	});
});
