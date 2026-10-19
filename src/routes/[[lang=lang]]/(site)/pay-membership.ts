import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { db } from '#lib/server/db/index.ts';
import { startMembership, type MembershipStart } from '#lib/server/services/memberships/index.ts';
import { PaymentConfigError } from '#lib/server/services/payments/providers/index.ts';

type Reason = Extract<MembershipStart, { ok: false }>['reason'];

const message = (reason: Reason): MessageKey => {
	if (reason === 'email_unverified') return 'membership.pay.emailUnverified';
	if (reason === 'provider_error') return 'membership.pay.providerError';
	return 'membership.pay.unavailable';
};

/**
 * "Pay the fee" on /join and /cabinet/membership (docs/07 section 3): the form carries no amount,
 * the server takes it from `membership_fee` (C11); the provider page opens on success.
 */
export async function payMembership({ locals, url }: RequestEvent) {
	if (!locals.user) redirect(303, `/login?returnTo=${encodeURIComponent(url.pathname)}`);
	let result: MembershipStart;
	try {
		result = await startMembership(db, locals.user.id, locals.locale);
	} catch (e) {
		if (!(e instanceof PaymentConfigError)) throw e;
		console.error('membership payment:', e.message);
		return fail(503, { payError: message('unavailable') });
	}
	if (result.ok) redirect(303, result.checkoutUrl);
	return fail(result.reason === 'provider_error' ? 502 : 400, { payError: message(result.reason) });
}
