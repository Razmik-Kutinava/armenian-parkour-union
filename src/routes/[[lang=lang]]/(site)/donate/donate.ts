import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { db } from '#lib/server/db/index.ts';
import { startDonation, type DonationStart } from '#lib/server/services/donations/index.ts';
import { PaymentConfigError } from '#lib/server/services/payments/providers/index.ts';
import { donationSchema } from '#lib/validation/donation.ts';
import { fieldErrors, keepValues } from '#lib/validation/form.ts';

const FIELDS = ['amount', 'purposeId', 'donorName', 'donorEmail', 'isAnonymous'] as const;

type Refusal = Exclude<Extract<DonationStart, { ok: false }>['reason'], 'amount'>;

const refusals: Record<Refusal, { status: number; message: MessageKey }> = {
	unavailable: { status: 400, message: 'donate.error.unavailable' },
	invalid: { status: 400, message: 'donate.error.invalid' },
	limited: { status: 429, message: 'auth.error.limited' },
	provider_error: { status: 502, message: 'donate.error.providerError' }
};

/**
 * docs/07 sections 3, 5.2: the amount from the form is checked against the settings by the service;
 * a member's name, email and id come from the session. The provider page opens on success.
 */
export async function donate(event: RequestEvent) {
	const { locals } = event;
	const form = await event.request.formData();
	const values = keepValues(form, FIELDS);
	const parsed = donationSchema(!locals.user).safeParse(Object.fromEntries(form));
	if (!parsed.success) return fail(400, { values, errors: fieldErrors(parsed.error) });
	const data = parsed.data;
	let result: DonationStart;
	try {
		result = await startDonation(
			db,
			{
				userId: locals.user?.id ?? null,
				amount: data.amount,
				purposeId: data.purposeId ?? null,
				donorName: data.donorName ?? null,
				donorEmail: data.donorEmail ?? null,
				isAnonymous: data.isAnonymous,
				locale: locals.locale
			},
			event.getClientAddress()
		);
	} catch (e) {
		if (!(e instanceof PaymentConfigError)) throw e;
		console.error('donation payment:', e.message);
		return fail(503, { values, message: refusals.unavailable.message });
	}
	if (result.ok) redirect(303, result.checkoutUrl);
	if (result.reason === 'amount') {
		return fail(400, { values, errors: { amount: 'donate.error.range' as MessageKey } });
	}
	const { status, message } = refusals[result.reason];
	return fail(status, { values, message });
}
