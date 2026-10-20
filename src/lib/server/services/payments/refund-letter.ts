import { translate } from '#lib/i18n/translate.ts';
import { formatPrice } from '#lib/money.ts';
import type { LimitDb } from '../../auth/rate-limit';
import type { Mail } from '../../mail/resend';
import { recipient } from '../donations/mail';
import type { PaymentEffect, PaymentEffects, PaymentKind, PaymentRow } from './effects';

const KINDS: PaymentKind[] = ['membership', 'donation', 'event_fee'];

/** docs/07 section 11 p. 4-5: amount and number; when the money arrives depends on the bank. */
export async function refundLetter(tx: LimitDb, payment: PaymentRow): Promise<Mail | null> {
	const to = await recipient(tx, payment);
	if (!to) return null;
	const { locale } = to;
	return {
		to: to.email,
		subject: translate(locale, 'payment.mail.refund.subject'),
		text: translate(locale, 'payment.mail.refund.text', {
			name: to.name,
			amount: formatPrice(payment.amountMinor, payment.currency, locale),
			payment: payment.id
		})
	};
}

/**
 * Every kind gets the refund letter after its own `refunded` effect, whoever refunded: an admin
 * or the provider (webhook, reconciliation). The letter waits for the commit.
 */
export function withRefundLetter(
	effects: PaymentEffects,
	send: (mail: Mail) => Promise<void>
): PaymentEffects {
	const result: PaymentEffects = { ...effects };
	for (const kind of KINDS) {
		const own = effects[kind]?.refunded;
		const refunded: PaymentEffect = async (tx, payment, after) => {
			await own?.(tx, payment, after);
			const letter = await refundLetter(tx, payment);
			if (letter) after(() => send(letter));
		};
		result[kind] = { ...effects[kind], refunded };
	}
	return result;
}
