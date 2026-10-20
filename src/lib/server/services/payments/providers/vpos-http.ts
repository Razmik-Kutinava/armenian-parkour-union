import { PaymentProviderError } from './types';
import { vposPayment } from './vpos-map';

const BASE_URL = 'https://api.vpos.am';
const TIMEOUT_MS = 15_000;

type Call = { method: 'GET' | 'POST'; body?: unknown; idempotencyKey?: string };

export function failure(status: number): PaymentProviderError {
	if (status === 404) return new PaymentProviderError('not_found');
	const code = status === 409 || status === 422 ? 'rejected' : 'unreachable';
	return new PaymentProviderError(code, `VPOS answered ${status}`);
}

/** The token stays in the header: errors carry only the HTTP status. */
export function createVposClient(token: string, fetch: typeof globalThis.fetch) {
	async function call(path: string, { method, body, idempotencyKey }: Call) {
		let response: Response;
		try {
			response = await fetch(`${BASE_URL}${path}`, {
				method,
				headers: {
					authorization: `Bearer ${token}`,
					accept: 'application/json',
					...(body !== undefined && { 'content-type': 'application/json' }),
					...(idempotencyKey && { 'idempotency-key': idempotencyKey })
				},
				body: body === undefined ? undefined : JSON.stringify(body),
				signal: AbortSignal.timeout(TIMEOUT_MS)
			});
		} catch {
			throw new PaymentProviderError('unreachable');
		}
		const data: unknown = await response.json().catch(() => null);
		return { status: response.status, data };
	}

	async function fetchPayment(providerPaymentId: string) {
		const query = new URLSearchParams({ paymentId: providerPaymentId });
		const { status, data } = await call(`/v1/payments?${query}`, { method: 'GET' });
		if (status !== 200) throw failure(status);
		return parsePayment(data);
	}

	return { call, fetchPayment };
}

export function parsePayment(data: unknown) {
	const parsed = vposPayment.safeParse(data);
	if (!parsed.success) throw new PaymentProviderError('unreachable', 'VPOS sent an unknown answer');
	return parsed.data;
}
