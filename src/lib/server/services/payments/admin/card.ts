import { and, desc, eq, or } from 'drizzle-orm';
import type { LocalizedText } from '#lib/i18n/localized.ts';
import type { LimitDb } from '../../../auth/rate-limit';
import { donationPurposes, memberships, payments } from '../../../db/schema/payments';
import { auditLog } from '../../../db/schema/service';
import { users } from '../../../db/schema/users';
import type { HistoryEntry } from '../../audit';
import { isUuid } from '../../users/target';
import type { PaymentRow } from '../effects';
import { payerEmail, payerName } from './list';
import { refundMode, type ProviderOf, type RefundMode } from './refund';

export type PaymentCard = PaymentRow & {
	payerName: string | null;
	payerEmail: string | null;
	purposeTitle: LocalizedText | null;
	membership: { id: string; status: string; startsAt: Date | null; endsAt: Date | null } | null;
	confirmedByName: string | null;
	history: HistoryEntry[];
	refundMode: RefundMode;
};

async function linkedMembership(db: LimitDb, payment: PaymentRow) {
	const byPayment = eq(memberships.paymentId, payment.id);
	const [row] = await db
		.select({
			id: memberships.id,
			status: memberships.status,
			startsAt: memberships.startsAt,
			endsAt: memberships.endsAt
		})
		.from(memberships)
		.where(
			payment.membershipId ? or(eq(memberships.id, payment.membershipId), byPayment) : byPayment
		)
		.limit(1);
	return row ?? null;
}

async function nameOf(db: LimitDb, id: string | null): Promise<string | null> {
	if (!id) return null;
	const [row] = await db.select({ name: users.name }).from(users).where(eq(users.id, id));
	return row?.name ?? null;
}

async function paymentHistory(db: LimitDb, id: string): Promise<HistoryEntry[]> {
	return db
		.select({
			id: auditLog.id,
			action: auditLog.action,
			actorName: users.name,
			before: auditLog.before,
			after: auditLog.after,
			createdAt: auditLog.createdAt
		})
		.from(auditLog)
		.leftJoin(users, eq(users.id, auditLog.actorId))
		.where(and(eq(auditLog.entityType, 'payment'), eq(auditLog.entityId, id)))
		.orderBy(desc(auditLog.createdAt))
		.limit(100);
}

/** docs/05 section 16: everything about one payment for an admin (contacts included, docs/04 section 4). */
export async function getPaymentCard(
	db: LimitDb,
	id: string,
	providerOf: ProviderOf
): Promise<PaymentCard | null> {
	if (!isUuid(id)) return null;
	const [found] = await db
		.select({ payment: payments, payerName, payerEmail, purposeTitle: donationPurposes.title })
		.from(payments)
		.leftJoin(users, eq(users.id, payments.userId))
		.leftJoin(donationPurposes, eq(donationPurposes.id, payments.donationPurposeId))
		.where(eq(payments.id, id));
	if (!found) return null;
	const { payment } = found;
	return {
		...payment,
		payerName: found.payerName,
		payerEmail: found.payerEmail,
		purposeTitle: (found.purposeTitle as LocalizedText | null) ?? null,
		membership: await linkedMembership(db, payment),
		confirmedByName: await nameOf(db, payment.confirmedBy),
		history: await paymentHistory(db, payment.id),
		refundMode: refundMode(payment, providerOf)
	};
}
