import { PUBLIC_SITE_URL } from '$app/env/private';
import type { ManualPaymentInput } from '#lib/validation/admin-payments.ts';
import type { LimitDb } from '../../../auth/rate-limit';
import { sendMail } from '../../../mail';
import type { Actor } from '../../users/target';
import { paymentEffects } from '../effects';
import { providerById } from '../providers';
import { getPaymentCard, type PaymentCard } from './card';
import { confirmPaymentManually } from './confirm';
import { recordManualPayment, type ManualResult } from './manual';
import { resendReceipt } from './receipt';
import { refundPayment } from './refund';
import type { AdminPaymentResult } from './support';

export { paymentsCsv, paymentsForExport, type ExportKind } from './export';
export { listPayments, paymentListOptions, paymentProviderOptions } from './list';
export { resolveReview } from './review';
export type { AdminPaymentResult, PaymentCard };

/* The admin payment actions wired to the real effects, providers and mail. */

export const paymentCard = (db: LimitDb, id: string): Promise<PaymentCard | null> =>
	getPaymentCard(db, id, providerById);

export const recordManual = (
	db: LimitDb,
	actor: Actor,
	input: ManualPaymentInput,
	ip: string | null
): Promise<ManualResult> => recordManualPayment(db, actor, input, { effects: paymentEffects, ip });

export const confirmManually = (
	db: LimitDb,
	actor: Actor,
	id: string,
	comment: string,
	ip: string | null
): Promise<AdminPaymentResult> =>
	confirmPaymentManually(db, actor, id, comment, { effects: paymentEffects, ip });

export const refund = (
	db: LimitDb,
	actor: Actor,
	id: string,
	reason: string,
	ip: string | null
): Promise<AdminPaymentResult> =>
	refundPayment(db, actor, id, reason, { effects: paymentEffects, providerOf: providerById, ip });

export const resendPaymentReceipt = (
	db: LimitDb,
	actor: Actor,
	id: string,
	ip: string | null
): Promise<AdminPaymentResult> =>
	resendReceipt(db, actor, id, { send: sendMail, siteUrl: PUBLIC_SITE_URL, ip });
