import { dev } from '$app/env';
import { error, fail } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.ts';
import { getMockCheckout, settleMockPayment } from '#lib/server/services/payments/mock-pay.ts';
import { providerById } from '#lib/server/services/payments/providers/index.ts';
import type { Actions, PageServerLoad } from './$types';

/* docs/07 section 4: the mock "bank" page, development only; a production build answers 404. */

export const load: PageServerLoad = async ({ params }) => {
	if (!dev) error(404, 'Not found');
	const payment = await getMockCheckout(db, params.id);
	if (!payment) error(404, 'Not found');
	return { payment };
};

export const actions: Actions = {
	settle: async ({ params, request, getClientAddress }) => {
		if (!dev) error(404, 'Not found');
		const status = String((await request.formData()).get('status') ?? '');
		const result = await settleMockPayment(db, providerById('mock'), params.id, status, {
			ip: getClientAddress()
		});
		if (result === 'invalid') return fail(400, { result });
		if (result === 'not_found') return fail(404, { result });
		return result === 'done' ? { result } : fail(500, { result });
	}
};
