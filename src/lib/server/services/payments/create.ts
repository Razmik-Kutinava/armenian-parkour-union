import { eq, sql } from 'drizzle-orm';
import type { Locale } from '#lib/i18n/locales.ts';
import type { Currency } from '#lib/money.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { payments } from '../../db/schema/payments';
import type { PaymentKind } from './effects';
import type { CreatePaymentResult, OnlineProvider } from './providers/types';
import { reusablePayment } from './reuse';
import { returnUrl, siteBase, validLinks, validShape } from './start-checks';
import { logStatusChange } from './status-log';

export type NewOnlinePayment = {
	kind: PaymentKind;
	/** `null` — a guest; only a donation. */
	userId: string | null;
	/** Counted on the server by the scenario (docs/07 section 3 p. 1). */
	amountMinor: number;
	currency: Currency;
	description: string;
	locale: Locale;
	payerEmail?: string;
	/** How long the payment waits for the provider (`expires_at`). */
	holdMinutes: number;
	membershipId?: string | null;
	donation?: {
		purposeId: string | null;
		donorName: string | null;
		donorEmail: string | null;
		isAnonymous: boolean;
	};
};

export type StartDeps = { provider: OnlineProvider | null; siteUrl: string | undefined };

export type StartResult =
	| { ok: true; paymentId: string; checkoutUrl: string; reused: boolean }
	| { ok: false; reason: 'online_off' | 'invalid' | 'provider_error'; paymentId?: string };

/**
 * docs/07 section 3: a pending payment, then a session at the provider. A user's presses are
 * serialised by a lock, so a double click cannot open two payments.
 */
export async function startOnlinePayment(
	db: LimitDb,
	input: NewOnlinePayment,
	{ provider, siteUrl }: StartDeps
): Promise<StartResult> {
	if (!provider) return { ok: false, reason: 'online_off' };
	const base = siteBase(siteUrl);
	if (!validShape(input, provider)) return { ok: false, reason: 'invalid' };
	return db.transaction(async (tx): Promise<StartResult> => {
		if (!(await validLinks(tx, input))) return { ok: false, reason: 'invalid' };
		if (input.userId) {
			const key = `payment:${input.userId}:${input.kind}`;
			await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
		}
		const existing = await reusablePayment(tx, input, provider.id);
		if (existing) return { ok: true, ...existing, reused: true };
		const [{ id }] = await tx
			.insert(payments)
			.values({
				userId: input.userId,
				kind: input.kind,
				amountMinor: input.amountMinor,
				currency: input.currency,
				provider: provider.id,
				expiresAt: new Date(Date.now() + input.holdMinutes * 60_000),
				membershipId: input.membershipId ?? null,
				donationPurposeId: input.donation?.purposeId ?? null,
				donorName: input.donation?.donorName ?? null,
				donorEmail: input.donation?.donorEmail ?? null,
				isAnonymous: input.donation?.isAnonymous ?? false
			})
			.returning({ id: payments.id });
		let created: CreatePaymentResult;
		try {
			created = await provider.createPayment({
				paymentId: id,
				amountMinor: input.amountMinor,
				currency: input.currency,
				description: input.description,
				successUrl: returnUrl(base, '/payment/success', id),
				cancelUrl: returnUrl(base, '/payment/cancel', id),
				locale: input.locale,
				payerEmail: input.payerEmail
			});
		} catch (error) {
			console.error(`payment ${id}: provider ${provider.id} did not start it`, error);
			const failed = {
				status: 'failed' as const,
				failureReason: 'provider_error',
				needsReview: false
			};
			await tx.update(payments).set(failed).where(eq(payments.id, id));
			await logStatusChange(
				tx,
				id,
				{ status: 'pending', failureReason: null, needsReview: false },
				failed
			);
			return { ok: false, reason: 'provider_error', paymentId: id };
		}
		await tx
			.update(payments)
			.set({
				providerPaymentId: created.providerPaymentId,
				providerPayload: { checkoutUrl: created.checkoutUrl, created: created.raw }
			})
			.where(eq(payments.id, id));
		return { ok: true, paymentId: id, checkoutUrl: created.checkoutUrl, reused: false };
	});
}
