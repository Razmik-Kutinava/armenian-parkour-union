import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { donationPurposes, payments } from '../../db/schema/payments';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { startOnlinePayment } from './create';
import { createMockProvider } from './providers/mock';
import { PaymentConfigError } from './providers/types';
import {
	SITE,
	auditOf,
	donationPayment,
	membershipPayment,
	paymentRow,
	paymentsOf,
	pendingMembership,
	spiedMock,
	unreachableProvider
} from './test-support';

/* docs/07 sections 3, 5.1 p. 6, 8, 14: a new online payment. */

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
					startOnlinePayment(tx, membershipPayment(userId), { provider: createMockProvider(), siteUrl })
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

	it('pressing "Pay" again reuses the unexpired pending membership payment', async () => {
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

	it('a membership payment links only a pending membership of the same user', async () => {
		await inRollback(async (tx) => {
			const { id: userId } = await insertUser(tx);
			const { id: otherId } = await insertUser(tx);
			const deps = { provider: createMockProvider(), siteUrl: SITE };
			const own = await pendingMembership(tx, userId);
			const result = await startOnlinePayment(tx, membershipPayment(userId, { membershipId: own }), deps);
			if (!result.ok) throw new Error(result.reason);
			expect((await paymentRow(tx, result.paymentId)).membershipId).toBe(own);
			const foreign = await pendingMembership(tx, otherId);
			for (const membershipId of [foreign, crypto.randomUUID(), 'nope']) {
				expect(
					await startOnlinePayment(tx, membershipPayment(userId, { membershipId }), deps)
				).toEqual({ ok: false, reason: 'invalid' });
			}
			expect(await paymentsOf(tx, userId)).toHaveLength(1);
			expect(await paymentsOf(tx, otherId)).toEqual([]);
		});
	});

	it('refuses a wrong amount, currency, payer or link and writes nothing', async () => {
		await inRollback(async (tx) => {
			const { id: userId } = await insertUser(tx);
			const amdOnly = { ...createMockProvider(), currencies: ['AMD'] as const };
			const deps = { provider: createMockProvider(), siteUrl: SITE };
			const [inactive] = await tx
				.insert(donationPurposes)
				.values({ title: { en: 'Old' }, isActive: false })
				.returning({ id: donationPurposes.id });
			const donation = donationPayment().donation!;
			const wrong = [
				membershipPayment(userId, { amountMinor: 0 }),
				membershipPayment(userId, { amountMinor: -100 }),
				membershipPayment(userId, { amountMinor: 1.5 }),
				membershipPayment(userId, { amountMinor: 2 ** 53 }),
				membershipPayment(userId, { currency: 'GBP' as 'AMD' }),
				membershipPayment(userId, { holdMinutes: 0 }),
				membershipPayment(userId, { description: '' }),
				membershipPayment(null),
				donationPayment({ userId, membershipId: await pendingMembership(tx, userId) }),
				donationPayment({ userId, donation: { ...donation, purposeId: inactive.id } }),
				donationPayment({ userId, donation: { ...donation, purposeId: crypto.randomUUID() } })
			];
			for (const input of wrong) {
				expect(await startOnlinePayment(tx, input, deps), JSON.stringify(input)).toEqual({
					ok: false,
					reason: 'invalid'
				});
			}
			expect(
				await startOnlinePayment(tx, membershipPayment(userId, { currency: 'USD' }), {
					provider: amdOnly,
					siteUrl: SITE
				})
			).toEqual({ ok: false, reason: 'invalid' });
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
