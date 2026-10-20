import { and, asc, eq, isNotNull, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { pickLocalized, type LocalizedText } from '#lib/i18n/localized.ts';
import { minorToInput, type Currency } from '#lib/money.ts';
import type { LimitDb } from '../../../auth/rate-limit';
import { donationPurposes, payments } from '../../../db/schema/payments';
import { users } from '../../../db/schema/users';
import { validDay, ZONE } from '../../audit-list';
import { toCsv } from '../../audit-csv';
import { payerEmail, payerName } from './list';

/* docs/07 section 12 p. 4, docs/05 section 16: CSV for accounting, fees and donations apart. */

export type ExportKind = 'membership' | 'donation';
export type ExportQuery = { kind: ExportKind; from?: string; to?: string };

const confirmer = alias(users, 'confirmer');

/** Money that arrived in the period (paid, later maybe refunded), by payment date in Yerevan. */
export async function paymentsForExport(db: LimitDb, query: ExportQuery, max = 10_000) {
	const where: SQL[] = [eq(payments.kind, query.kind), isNotNull(payments.paidAt)];
	const from = validDay(query.from);
	if (from) where.push(sql`${payments.paidAt} >= (${from}::date)::timestamp at time zone ${ZONE}`);
	const to = validDay(query.to);
	if (to) where.push(sql`${payments.paidAt} < (${to}::date + 1)::timestamp at time zone ${ZONE}`);
	return db
		.select({
			id: payments.id,
			paidAt: payments.paidAt,
			status: payments.status,
			payerName,
			payerEmail,
			amountMinor: payments.amountMinor,
			currency: payments.currency,
			provider: payments.provider,
			providerPaymentId: payments.providerPaymentId,
			refundedAt: payments.refundedAt,
			confirmedBy: confirmer.name,
			purposeTitle: donationPurposes.title,
			isAnonymous: payments.isAnonymous
		})
		.from(payments)
		.leftJoin(users, eq(users.id, payments.userId))
		.leftJoin(confirmer, eq(confirmer.id, payments.confirmedBy))
		.leftJoin(donationPurposes, eq(donationPurposes.id, payments.donationPurposeId))
		.where(and(...where))
		.orderBy(asc(payments.paidAt), asc(payments.id))
		.limit(max);
}

export type ExportRow = Awaited<ReturnType<typeof paymentsForExport>>[number];

const HEADER = [
	'paid_at',
	'payment_id',
	'status',
	'payer_name',
	'payer_email',
	'amount',
	'currency',
	'provider',
	'provider_payment_id',
	'refunded_at',
	'confirmed_by'
];

export function paymentsCsv(kind: ExportKind, rows: ExportRow[]): string {
	const donation = kind === 'donation';
	return toCsv(
		donation ? [...HEADER, 'purpose', 'is_anonymous'] : HEADER,
		rows.map((r) => {
			const base = [
				r.paidAt,
				r.id,
				r.status,
				r.payerName,
				r.payerEmail,
				minorToInput(r.amountMinor, r.currency as Currency),
				r.currency,
				r.provider,
				r.providerPaymentId,
				r.refundedAt,
				r.confirmedBy
			];
			if (!donation) return base;
			const purpose = r.purposeTitle ? pickLocalized(r.purposeTitle as LocalizedText, 'en') : '';
			return [...base, purpose, r.isAnonymous];
		})
	);
}
