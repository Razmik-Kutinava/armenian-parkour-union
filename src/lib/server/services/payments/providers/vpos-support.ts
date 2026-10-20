import type { CreatePaymentInput } from './types';
import { createVposProvider } from './vpos';

/* Test support only: VPOS.am answers from openapi.yaml v0.1.0, no network. */

type Call = { url: string; method: string; headers: Headers; body: unknown };
export type Reply = { status: number; body?: unknown } | Error;

function fakeFetch(replies: Reply[]) {
	const calls: Call[] = [];
	const fetch = (async (url: string | URL, init: RequestInit = {}) => {
		calls.push({
			url: String(url),
			method: init.method ?? 'GET',
			headers: new Headers(init.headers),
			body: init.body ? JSON.parse(String(init.body)) : undefined
		});
		const reply = replies.shift() ?? { status: 500 };
		if (reply instanceof Error) throw reply;
		return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
			status: reply.status,
			headers: { 'content-type': 'application/json' }
		});
	}) as typeof globalThis.fetch;
	return { fetch, calls };
}

/** A provider whose `fetch` gives these replies in order and records every request. */
export function vposWith(...replies: Reply[]) {
	const fake = fakeFetch(replies);
	const vpos = createVposProvider({
		token: 'test-token',
		webhookSecret: 'whsec',
		livemode: false,
		fetch: fake.fetch
	});
	return { vpos, calls: fake.calls };
}

export const input: CreatePaymentInput = {
	paymentId: '0b9f3c1e-5d4a-4c2b-9e8f-1a2b3c4d5e6f',
	amountMinor: 5000,
	currency: 'AMD',
	description: 'Membership fee',
	successUrl: 'https://parkour.am/ru/payment/success?pid=0b9f3c1e-5d4a-4c2b-9e8f-1a2b3c4d5e6f',
	cancelUrl: 'https://parkour.am/ru/payment/cancel?pid=0b9f3c1e-5d4a-4c2b-9e8f-1a2b3c4d5e6f',
	locale: 'ru',
	payerEmail: 'member@example.com'
};

/* 5000 AMD in VPOS minor units under ISO 4217 (two decimals) — open question in docs/questions.md. */
export const session = (over: Record<string, unknown> = {}) => ({
	ok: true,
	id: 'pay_abcdef012345678901',
	merchantOrderId: input.paymentId,
	provider: 'ameriabank_vpos',
	amountMinor: 500000,
	currency: 'AMD',
	status: 'pending_redirect',
	fiscalStatus: 'not_required',
	checkoutUrl: 'https://checkout.vpos.am/s/abc',
	customer: { email: 'member@example.com', phone: '+37400000000', name: 'Test Buyer' },
	metadata: { description: 'Membership fee' },
	createdAt: '2026-10-20T10:00:00.000Z',
	updatedAt: '2026-10-20T10:00:00.000Z',
	...over
});

export const paidSession = { status: 200, body: session({ status: 'paid' }) };
