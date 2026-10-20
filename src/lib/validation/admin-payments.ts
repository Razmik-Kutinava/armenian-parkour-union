import { z } from 'zod';
import { CURRENCIES, priceToMinor } from '#lib/money.ts';
import { email, name, optional } from './auth';

/* Admin forms for payments (docs/05 section 16, docs/07 section 9). Messages are i18n keys. */

export const MANUAL_KINDS = ['membership', 'donation'] as const;
export const EXPORT_KINDS = MANUAL_KINDS;

export type ManualPaymentInput = {
	kind: (typeof MANUAL_KINDS)[number];
	amountMinor: number;
	currency: (typeof CURRENCIES)[number];
	/** `YYYY-MM-DD`, a day in Yerevan. */
	paidOn: string;
	comment: string;
	/** A member pays: the account email. */
	payerEmail: string | null;
	donorName: string | null;
	donorEmail: string | null;
	isAnonymous: boolean;
	purposeId: string | null;
};

const required = (max: number) =>
	z
		.string({ error: 'auth.error.required' })
		.trim()
		.min(1, { error: 'auth.error.required' })
		.max(max, { error: 'auth.error.tooLong' });

export const commentSchema = z.object({ comment: required(1000) });
export const exportQuerySchema = z.object({ kind: z.enum(EXPORT_KINDS) });

/** Today in Yerevan, where the federation works (no daylight saving: +04:00). */
export const yerevanDay = (now: Date) =>
	new Date(now.getTime() + 4 * 3_600_000).toISOString().slice(0, 10);

function realDay(value: string): boolean {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!m) return false;
	const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
	return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

export function manualPaymentSchema(now: Date = new Date()): z.ZodType<ManualPaymentInput> {
	const today = yerevanDay(now);
	return z
		.object({
			kind: z.enum(MANUAL_KINDS, { error: 'payments.error.kind' }),
			amount: z.string({ error: 'payments.error.amount' }).trim(),
			currency: z.enum(CURRENCIES, { error: 'payments.error.currency' }),
			paidOn: z
				.string({ error: 'payments.error.date' })
				.refine((v) => realDay(v) && v <= today, { error: 'payments.error.date' }),
			comment: required(1000),
			payerEmail: optional(email),
			donorName: optional(name),
			donorEmail: optional(email),
			isAnonymous: z.preprocess((v) => v === 'on', z.boolean()),
			purposeId: optional(z.uuid({ error: 'payments.error.purpose' }))
		})
		.transform((f, ctx): ManualPaymentInput => {
			const amountMinor = priceToMinor(f.amount, f.currency);
			if (!amountMinor) {
				ctx.addIssue({ code: 'custom', path: ['amount'], message: 'payments.error.amount' });
			}
			const payerEmail = f.payerEmail ?? null;
			if (f.kind === 'membership' && !payerEmail) {
				ctx.addIssue({ code: 'custom', path: ['payerEmail'], message: 'payments.error.payer' });
			}
			if (f.kind === 'donation' && !payerEmail && !f.donorName) {
				ctx.addIssue({ code: 'custom', path: ['donorName'], message: 'payments.error.donorName' });
			}
			const guest = f.kind === 'donation' && !payerEmail;
			return {
				kind: f.kind,
				amountMinor: amountMinor ?? 0,
				currency: f.currency,
				paidOn: f.paidOn,
				comment: f.comment,
				payerEmail,
				donorName: guest ? (f.donorName ?? null) : null,
				donorEmail: guest ? (f.donorEmail ?? null) : null,
				isAnonymous: f.kind === 'donation' && f.isAnonymous,
				purposeId: f.kind === 'donation' ? (f.purposeId ?? null) : null
			};
		});
}
