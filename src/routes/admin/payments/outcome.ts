import { error, fail } from '@sveltejs/kit';
import type { MessageKey } from '#lib/i18n/translate.ts';
import type { AdminPaymentResult } from '#lib/server/services/payments/admin/index.ts';

const refusals: Record<
	Exclude<AdminPaymentResult, 'ok' | 'not_found' | 'not_allowed'>,
	MessageKey
> = {
	invalid: 'payments.error.comment',
	wrong_status: 'payments.error.wrongStatus',
	unsupported: 'payments.error.unsupported',
	provider_error: 'payments.error.providerError',
	no_recipient: 'payments.error.noRecipient',
	mail_failed: 'payments.error.mailFailed'
};

/** Action answer for a payment change: 404 / 403 without details, refusals as a message. */
export function paymentOutcome(result: AdminPaymentResult, done: MessageKey = 'payments.saved') {
	if (result === 'not_found') error(404, 'Not found');
	if (result === 'not_allowed') error(403, 'Forbidden');
	if (result === 'ok') return { done };
	return fail(400, { message: refusals[result] });
}
