import { and, asc, eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { memberships } from '../../db/schema/payments';
import { auditLog, siteSettings } from '../../db/schema/service';
import { insertUser } from '../../db/test-db';
import type { Mail } from '../../mail/resend';
import { applyProviderStatus } from '../payments/apply';
import type { MockProvider } from '../payments/providers/mock';
import { SITE, paymentRow } from '../payments/test-support';
import { membershipEffects } from './effects';

/* Test support only: membership tests run inside a rolled-back transaction. */

export const FEE = { amount_minor: 20_000, currency: 'AMD', period_months: 12 };

export async function putSetting(tx: LimitDb, key: string, value: unknown) {
	await tx
		.insert(siteSettings)
		.values({ key, value })
		.onConflictDoUpdate({ target: siteSettings.key, set: { value } });
}

export async function feeSettings(tx: LimitDb, fee: unknown = FEE, waitMinutes: unknown = 30) {
	await putSetting(tx, 'membership_fee', fee);
	await putSetting(tx, 'payment_wait_minutes', waitMinutes);
}

export const verifiedUser = (tx: LimitDb, values: Parameters<typeof insertUser>[1] = {}) =>
	insertUser(tx, { emailVerified: true, ...values });

/** Letters the code tried to send; `failing` throws like an unreachable mail service. */
export function mailbox(failing = false) {
	const sent: Mail[] = [];
	const send = async (mail: Mail) => {
		if (failing) throw new Error('mail is down');
		sent.push(mail);
	};
	return { sent, send };
}

export function effectsWith(send: (mail: Mail) => Promise<void>) {
	return { membership: membershipEffects({ send, siteUrl: SITE }) };
}

export async function membershipsOf(tx: LimitDb, userId: string) {
	return tx
		.select()
		.from(memberships)
		.where(eq(memberships.userId, userId))
		.orderBy(asc(memberships.createdAt));
}

export async function membershipRow(tx: LimitDb, id: string) {
	const [row] = await tx.select().from(memberships).where(eq(memberships.id, id));
	return row;
}

export async function auditFor(tx: LimitDb, entityType: string, entityId: string) {
	return tx
		.select()
		.from(auditLog)
		.where(and(eq(auditLog.entityType, entityType), eq(auditLog.entityId, entityId)))
		.orderBy(asc(auditLog.createdAt));
}

/** The "bank" settles the payment, then the provider path applies it (as a webhook would). */
export async function settle(
	tx: LimitDb,
	provider: MockProvider,
	paymentId: string,
	status: 'paid' | 'failed' | 'cancelled' | 'refunded',
	effects: ReturnType<typeof effectsWith>
) {
	const { providerPaymentId } = await paymentRow(tx, paymentId);
	provider.simulate(providerPaymentId!, status);
	const state = await provider.getStatus(providerPaymentId!);
	return applyProviderStatus(
		tx,
		{ provider: provider.id, providerPaymentId: providerPaymentId!, ...state },
		effects
	);
}

export const daysFromNow = (days: number, from = new Date()) =>
	new Date(from.getTime() + days * 86_400_000);
