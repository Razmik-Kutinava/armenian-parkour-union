import type { Mail } from '../../mail/resend';
import type { PaymentEffect } from '../payments/effects';
import { thanksLetter } from './mail';

export type DonationEffectDeps = { send: (mail: Mail) => Promise<void> };

/**
 * docs/07 sections 5.2 p. 3, 11 p. 3: a donation changes nothing but its status — no points, no
 * level. Paid — a thank-you letter after the commit. The refund letter — `payments/refund-letter.ts`.
 */
export function donationEffects(deps: DonationEffectDeps): Partial<Record<'paid', PaymentEffect>> {
	return {
		paid: async (tx, payment, after) => {
			const letter = await thanksLetter(tx, payment);
			if (letter) after(() => deps.send(letter));
		}
	};
}
