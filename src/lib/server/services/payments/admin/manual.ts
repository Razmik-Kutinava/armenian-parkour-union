import { and, eq, isNull, sql } from 'drizzle-orm';
import { yerevanDay, type ManualPaymentInput } from '#lib/validation/admin-payments.ts';
import type { LimitDb } from '../../../auth/rate-limit';
import { donationPurposes, memberships, payments } from '../../../db/schema/payments';
import { users } from '../../../db/schema/users';
import { writeAudit } from '../../audit';
import type { Actor } from '../../users/target';
import { runEffects, withAfterCommit, type PaymentEffects } from '../effects';
import { canManage } from './support';

export type { ManualPaymentInput };

type Refusal =
	'not_allowed' | 'payer_required' | 'payer_not_found' | 'purpose_invalid' | 'future_date';
export type ManualResult = { ok: true; paymentId: string } | { ok: false; reason: Refusal };
export type ManualDeps = { effects: PaymentEffects; ip: string | null; today?: Date };

const refuse = (reason: Refusal): ManualResult => ({ ok: false, reason });

async function payerId(tx: LimitDb, email: string): Promise<string | null> {
	const [row] = await tx
		.select({ id: users.id })
		.from(users)
		.where(and(sql`lower(${users.email}) = ${email.toLowerCase()}`, isNull(users.deletedAt)));
	return row?.id ?? null;
}

async function activePurpose(tx: LimitDb, id: string): Promise<boolean> {
	const [row] = await tx
		.select({ id: donationPurposes.id })
		.from(donationPurposes)
		.where(and(eq(donationPurposes.id, id), eq(donationPurposes.isActive, true)));
	return !!row;
}

/**
 * docs/07 section 9: a transfer outside the site, recorded as paid by an admin. The same effects
 * as an online payment run in the same transaction (a fee opens its own membership row first).
 */
export async function recordManualPayment(
	db: LimitDb,
	actor: Actor,
	input: ManualPaymentInput,
	deps: ManualDeps
): Promise<ManualResult> {
	if (!canManage(actor)) return refuse('not_allowed');
	if (input.paidOn > yerevanDay(deps.today ?? new Date())) return refuse('future_date');
	if (input.kind === 'membership' && !input.payerEmail) return refuse('payer_required');
	return withAfterCommit((after) =>
		db.transaction(async (tx): Promise<ManualResult> => {
			const userId = input.payerEmail ? await payerId(tx, input.payerEmail) : null;
			if (input.payerEmail && !userId) return refuse('payer_not_found');
			const donation = input.kind === 'donation';
			if (donation && input.purposeId && !(await activePurpose(tx, input.purposeId))) {
				return refuse('purpose_invalid');
			}
			const [membership] =
				!donation && userId
					? await tx.insert(memberships).values({ userId }).returning({ id: memberships.id })
					: [];
			const [payment] = await tx
				.insert(payments)
				.values({
					userId,
					kind: input.kind,
					status: 'paid',
					amountMinor: input.amountMinor,
					currency: input.currency,
					provider: 'manual',
					providerPayload: { manual: { comment: input.comment } },
					paidAt: new Date(`${input.paidOn}T00:00:00+04:00`),
					confirmedBy: actor.id,
					membershipId: membership?.id ?? null,
					donationPurposeId: donation ? input.purposeId : null,
					donorName: donation && !userId ? input.donorName : null,
					donorEmail: donation && !userId ? input.donorEmail : null,
					isAnonymous: donation && input.isAnonymous
				})
				.returning();
			if (membership) {
				await tx
					.update(memberships)
					.set({ paymentId: payment.id })
					.where(eq(memberships.id, membership.id));
			}
			await runEffects(tx, deps.effects, payment, after);
			await writeAudit(tx, {
				actorId: actor.id,
				action: 'payment.confirm_manual',
				entityType: 'payment',
				entityId: payment.id,
				after: {
					status: 'paid',
					kind: input.kind,
					amountMinor: input.amountMinor,
					currency: input.currency,
					paidOn: input.paidOn,
					comment: input.comment
				},
				ip: deps.ip
			});
			return { ok: true, paymentId: payment.id };
		})
	);
}
