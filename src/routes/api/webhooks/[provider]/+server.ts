import { db } from '#lib/server/db/index.ts';
import { receiveWebhook } from '#lib/server/services/payments/index.ts';
import { providerById } from '#lib/server/services/payments/providers/index.ts';
import type { RequestHandler } from './$types';

/** docs/07 section 6: no session — the provider's signature is the only protection. */
export const POST: RequestHandler = async (event) => {
	const provider = providerById(event.params.provider);
	const status = await receiveWebhook(db, provider, event.request, {
		ip: event.getClientAddress()
	});
	return new Response(null, { status });
};
