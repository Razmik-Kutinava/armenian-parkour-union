import { error, type RequestEvent } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.ts';
import { checkPaymentReturn } from '#lib/server/services/payments/index.ts';

/* docs/06 section 3.3, docs/07 section 7 p. 1: shared by /payment/success and /payment/cancel. */
export async function paymentReturn({ url, getClientAddress, setHeaders }: RequestEvent) {
	setHeaders({ 'cache-control': 'no-store' });
	const pid = url.searchParams.get('pid') ?? '';
	const payment = await checkPaymentReturn(db, pid, getClientAddress());
	if (!payment) error(404, 'Not found');
	return { payment };
}
