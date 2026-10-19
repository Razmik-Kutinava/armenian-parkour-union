import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { payments } from '../../db/schema/payments';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { startOnlinePayment } from './create';
import { createMockProvider } from './providers/mock';
import {
	SITE,
	donationPayment,
	membershipPayment,
	paymentRow,
	paymentsOf,
	spiedMock
} from './test-support';

/* docs/07 section 5.1 p. 6, section 8 "double click": one open payment per scenario. */

const MINUTE = 60_000;

describe.skipIf(!testDbUrl)('payments: pressing "Pay" again', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('reuses the unexpired pending membership payment', async () => {
		await inRollback(async (tx) => {
			const { id: userId } = await insertUser(tx);
			const { mock, calls } = spiedMock();
			const deps = { provider: mock, siteUrl: SITE };
			const first = await startOnlinePayment(tx, membershipPayment(userId), deps);
			const second = await startOnlinePayment(tx, membershipPayment(userId), deps);
			if (!first.ok || !second.ok) throw new Error('not started');
			expect(second).toEqual({ ...first, reused: true });
			expect(calls).toHaveLength(1);
			expect(await paymentsOf(tx, userId)).toHaveLength(1);
		});
	});

	it('an expired, finished or different payment is not reused', async () => {
		await inRollback(async (tx) => {
			const { id: userId } = await insertUser(tx);
			const deps = { provider: createMockProvider(), siteUrl: SITE };
			const start = async (extra = {}) => {
				const result = await startOnlinePayment(tx, membershipPayment(userId, extra), deps);
				if (!result.ok) throw new Error(result.reason);
				return result;
			};
			const expired = await start();
			await tx
				.update(payments)
				.set({ expiresAt: new Date(Date.now() - MINUTE) })
				.where(eq(payments.id, expired.paymentId));
			const failed = await start();
			expect(failed.paymentId).not.toBe(expired.paymentId);
			await tx.update(payments).set({ status: 'failed' }).where(eq(payments.id, failed.paymentId));
			const fresh = await start();
			expect(fresh.reused).toBe(false);
			const otherAmount = await start({ amountMinor: 2_500_000 });
			expect(otherAmount.paymentId).not.toBe(fresh.paymentId);
			const otherCurrency = await start({ currency: 'USD', amountMinor: 5_000 });
			expect(otherCurrency.paymentId).not.toBe(fresh.paymentId);
			const sameAgain = await start();
			expect(sameAgain).toEqual({ ...fresh, reused: true });
			const otherProvider = await startOnlinePayment(tx, membershipPayment(userId), {
				provider: { ...createMockProvider(), id: 'other' },
				siteUrl: SITE
			});
			if (!otherProvider.ok) throw new Error(otherProvider.reason);
			expect(otherProvider.paymentId).not.toBe(fresh.paymentId);
			expect(await paymentsOf(tx, userId)).toHaveLength(6);
		});
	});

	it('every donation is a new payment; a guest donates with name and email', async () => {
		await inRollback(async (tx) => {
			const deps = { provider: createMockProvider(), siteUrl: SITE };
			const first = await startOnlinePayment(tx, donationPayment(), deps);
			const second = await startOnlinePayment(tx, donationPayment(), deps);
			if (!first.ok || !second.ok) throw new Error('not started');
			expect(second.paymentId).not.toBe(first.paymentId);
			expect(await paymentRow(tx, first.paymentId)).toMatchObject({
				userId: null,
				kind: 'donation',
				donorName: 'Anna',
				donorEmail: 'anna@example.com',
				isAnonymous: false,
				membershipId: null
			});
		});
	});
});
