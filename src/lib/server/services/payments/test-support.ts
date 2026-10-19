import { and, asc, eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { memberships, payments } from '../../db/schema/payments';
import { auditLog } from '../../db/schema/service';
import { createMockProvider } from './providers/mock';
import { PaymentProviderError, type CreatePaymentInput, type OnlineProvider } from './providers/types';
import type { NewOnlinePayment } from './create';

/* Test support only: payment service tests run inside a rolled-back transaction. */

export const SITE = 'https://parkour.test';

/** Mock provider that remembers what it was asked to create. */
export function spiedMock() {
	const mock = createMockProvider();
	const calls: CreatePaymentInput[] = [];
	const createPayment = mock.createPayment.bind(mock);
	mock.createPayment = async (input) => {
		calls.push(input);
		return createPayment(input);
	};
	return { mock, calls };
}

export function unreachableProvider(): OnlineProvider {
	return {
		...createMockProvider(),
		createPayment: async () => {
			throw new PaymentProviderError('unreachable');
		}
	};
}

export const membershipPayment = (
	userId: string | null,
	extra: Partial<NewOnlinePayment> = {}
): NewOnlinePayment => ({
	kind: 'membership',
	userId,
	amountMinor: 2_000_000,
	currency: 'AMD',
	description: 'Membership fee',
	locale: 'en',
	holdMinutes: 30,
	...extra
});

export const donationPayment = (extra: Partial<NewOnlinePayment> = {}): NewOnlinePayment => ({
	kind: 'donation',
	userId: null,
	amountMinor: 500_000,
	currency: 'AMD',
	description: 'Donation',
	locale: 'en',
	holdMinutes: 30,
	donation: {
		purposeId: null,
		donorName: 'Anna',
		donorEmail: 'anna@example.com',
		isAnonymous: false
	},
	...extra
});

export async function paymentRow(tx: LimitDb, id: string) {
	const [row] = await tx.select().from(payments).where(eq(payments.id, id));
	return row;
}

export async function paymentsOf(tx: LimitDb, userId: string) {
	return tx.select().from(payments).where(eq(payments.userId, userId));
}

export async function auditOf(tx: LimitDb, paymentId: string) {
	return tx
		.select()
		.from(auditLog)
		.where(and(eq(auditLog.entityType, 'payment'), eq(auditLog.entityId, paymentId)))
		.orderBy(asc(auditLog.createdAt));
}

export async function pendingMembership(tx: LimitDb, userId: string) {
	const [row] = await tx.insert(memberships).values({ userId }).returning({ id: memberships.id });
	return row.id;
}
