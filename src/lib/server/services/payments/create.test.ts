import { afterAll, describe, expect, it } from 'vitest';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { startOnlinePayment } from './create';
import { createMockProvider } from './providers/mock';
import { PaymentConfigError } from './providers/types';
import {
	SITE,
	auditOf,
	membershipPayment,
	paymentRow,
	paymentsOf,
	spiedMock,
	unreachableProvider
} from './test-support';

/* docs/07 sections 3, 8, 14: a new online payment. */

const MINUTE = 60_000;

describe.skipIf(!testDbUrl)('payments: starting an online payment', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('records a pending payment, then a provider session; keeps its id and checkout page', async () => {
		await inRollback(async (tx) => {
			const { id: userId } = await insertUser(tx);
			const { mock, calls } = spiedMock();
			const before = Date.now();
			const result = await startOnlinePayment(tx, membershipPayment(userId), {
				provider: mock,
				siteUrl: SITE
			});
			if (!result.ok) throw new Error(result.reason);
			expect(result.reused).toBe(false);
			expect(calls).toHaveLength(1);
			const row = await paymentRow(tx, result.paymentId);
			expect(row).toMatchObject({
				userId,
				kind: 'membership',
				status: 'pending',
				amountMinor: 2_000_000,
				currency: 'AMD',
				provider: 'mock',
				needsReview: false,
				paidAt: null
			});
			expect(row.providerPaymentId).toMatch(/^mock_/);
			expect(result.checkoutUrl).toBe(`${SITE}/dev/mock-pay/${row.providerPaymentId}`);
			expect(row.providerPayload).toMatchObject({ checkoutUrl: result.checkoutUrl });
			const expires = row.expiresAt!.getTime();
			expect(expires).toBeGreaterThanOrEqual(before + 30 * MINUTE - 5_000);
			expect(expires).toBeLessThanOrEqual(Date.now() + 30 * MINUTE + 5_000);
			const state = await mock.getStatus(row.providerPaymentId!);
			expect(state).toMatchObject({ status: 'pending', amountMinor: 2_000_000, currency: 'AMD' });
			expect(await auditOf(tx, result.paymentId)).toEqual([]);
		});
	});

	it('return addresses are built from the site address and our payment id only', async () => {
		await inRollback(async (tx) => {
			const { id: userId } = await insertUser(tx);
			const { mock, calls } = spiedMock();
			const result = await startOnlinePayment(
				tx,
				membershipPayment(userId, { locale: 'hy', payerEmail: 'p@example.com' }),
				{ provider: mock, siteUrl: `${SITE}/` }
			);
			if (!result.ok) throw new Error(result.reason);
			expect(calls[0]).toMatchObject({
				paymentId: result.paymentId,
				amountMinor: 2_000_000,
				currency: 'AMD',
				description: 'Membership fee',
				locale: 'hy',
				payerEmail: 'p@example.com',
				successUrl: `${SITE}/payment/success?pid=${result.paymentId}`,
				cancelUrl: `${SITE}/payment/cancel?pid=${result.paymentId}`
			});
		});
	});

	it('without a valid site address it fails loudly and writes nothing', async () => {
		await inRollback(async (tx) => {
			const { id: userId } = await insertUser(tx);
			for (const siteUrl of [undefined, '', 'not a url', 'javascript:alert(1)', 'ftp://x.test']) {
				await expect(
					startOnlinePayment(tx, membershipPayment(userId), {
						provider: createMockProvider(),
						siteUrl
					})
				).rejects.toBeInstanceOf(PaymentConfigError);
			}
			expect(await paymentsOf(tx, userId)).toEqual([]);
		});
	});

	it('online payment switched off: no payment is recorded', async () => {
		await inRollback(async (tx) => {
			const { id: userId } = await insertUser(tx);
			const result = await startOnlinePayment(tx, membershipPayment(userId), {
				provider: null,
				siteUrl: SITE
			});
			expect(result).toEqual({ ok: false, reason: 'online_off' });
			expect(await paymentsOf(tx, userId)).toEqual([]);
		});
	});

	it('provider does not answer: the payment fails with a reason and the change is logged', async () => {
		await inRollback(async (tx) => {
			const { id: userId } = await insertUser(tx);
			const result = await startOnlinePayment(tx, membershipPayment(userId), {
				provider: unreachableProvider(),
				siteUrl: SITE
			});
			if (result.ok) throw new Error('should fail');
			expect(result.reason).toBe('provider_error');
			const row = await paymentRow(tx, result.paymentId!);
			expect(row).toMatchObject({
				status: 'failed',
				failureReason: 'provider_error',
				providerPaymentId: null
			});
			const audit = await auditOf(tx, row.id);
			expect(audit).toHaveLength(1);
			expect(audit[0]).toMatchObject({
				actorId: null,
				action: 'payment.status',
				before: { status: 'pending' },
				after: { status: 'failed', failureReason: 'provider_error' }
			});
			const retry = await startOnlinePayment(tx, membershipPayment(userId), {
				provider: createMockProvider(),
				siteUrl: SITE
			});
			expect(retry.ok && retry.reused).toBe(false);
		});
	});
});
