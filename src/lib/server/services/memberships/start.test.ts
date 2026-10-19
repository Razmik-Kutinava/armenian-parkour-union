import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { users } from '../../db/schema/users';
import { testDb, testDbUrl } from '../../db/test-db';
import { createMockProvider } from '../payments/providers/mock';
import { SITE, paymentRow, paymentsOf, spiedMock, unreachableProvider } from '../payments/test-support';
import { startMembershipPayment } from './start';
import { FEE, feeSettings, membershipsOf, verifiedUser } from './test-support';

/* docs/07 section 5.1 p. 1-3, 6; docs/03 section 1 p. 2: the fee comes from the settings only, a
 * pending membership gives no rights, a second press goes to the same payment. */

describe.skipIf(!testDbUrl)('memberships: starting the fee payment', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('pending membership linked both ways; amount, currency and wait time from the settings', async () => {
		await inRollback(async (tx) => {
			await feeSettings(tx, { ...FEE, amount_minor: 15_000 }, 45);
			const user = await verifiedUser(tx);
			const { mock, calls } = spiedMock();
			const before = Date.now();
			const result = await startMembershipPayment(tx, user.id, 'en', {
				provider: mock,
				siteUrl: SITE
			});
			if (!result.ok) throw new Error(result.reason);
			expect(result.reused).toBe(false);
			const [membership] = await membershipsOf(tx, user.id);
			expect(membership).toMatchObject({
				status: 'pending',
				startsAt: null,
				endsAt: null,
				paymentId: result.paymentId
			});
			const payment = await paymentRow(tx, result.paymentId);
			expect(payment).toMatchObject({
				kind: 'membership',
				status: 'pending',
				amountMinor: 15_000,
				currency: 'AMD',
				userId: user.id,
				membershipId: membership.id
			});
			const waitMs = payment.expiresAt!.getTime() - before;
			expect(waitMs).toBeGreaterThan(44 * 60_000);
			expect(waitMs).toBeLessThan(46 * 60_000);
			expect(calls).toMatchObject([{ amountMinor: 15_000, currency: 'AMD' }]);
		});
	});

	it('a second press goes to the same payment and the same membership', async () => {
		await inRollback(async (tx) => {
			await feeSettings(tx);
			const user = await verifiedUser(tx);
			const deps = { provider: createMockProvider(), siteUrl: SITE };
			const first = await startMembershipPayment(tx, user.id, 'en', deps);
			const second = await startMembershipPayment(tx, user.id, 'en', deps);
			if (!first.ok || !second.ok) throw new Error('not started');
			expect(second).toMatchObject({
				paymentId: first.paymentId,
				checkoutUrl: first.checkoutUrl,
				reused: true
			});
			expect(await membershipsOf(tx, user.id)).toHaveLength(1);
			expect(await paymentsOf(tx, user.id)).toHaveLength(1);
		});
	});

	it('the fee changed between presses: a new membership and a new payment of the new amount', async () => {
		await inRollback(async (tx) => {
			await feeSettings(tx);
			const user = await verifiedUser(tx);
			const deps = { provider: createMockProvider(), siteUrl: SITE };
			const first = await startMembershipPayment(tx, user.id, 'en', deps);
			await feeSettings(tx, { ...FEE, amount_minor: 30_000 });
			const second = await startMembershipPayment(tx, user.id, 'en', deps);
			if (!first.ok || !second.ok) throw new Error('not started');
			expect(second.paymentId).not.toBe(first.paymentId);
			expect((await paymentRow(tx, second.paymentId)).amountMinor).toBe(30_000);
			expect(await membershipsOf(tx, user.id)).toHaveLength(2);
		});
	});

	it('email not confirmed: refused, nothing created', async () => {
		await inRollback(async (tx) => {
			await feeSettings(tx);
			const user = await verifiedUser(tx, { emailVerified: false });
			const deps = { provider: createMockProvider(), siteUrl: SITE };
			expect(await startMembershipPayment(tx, user.id, 'en', deps)).toEqual({
				ok: false,
				reason: 'email_unverified'
			});
			expect(await membershipsOf(tx, user.id)).toEqual([]);
			expect(await paymentsOf(tx, user.id)).toEqual([]);
		});
	});

	it('blocked or deleted user: refused', async () => {
		await inRollback(async (tx) => {
			await feeSettings(tx);
			const deps = { provider: createMockProvider(), siteUrl: SITE };
			const blocked = await verifiedUser(tx, { status: 'blocked' });
			expect(await startMembershipPayment(tx, blocked.id, 'en', deps)).toMatchObject({
				reason: 'blocked'
			});
			const deleted = await verifiedUser(tx);
			await tx.update(users).set({ deletedAt: new Date() }).where(eq(users.id, deleted.id));
			expect(await startMembershipPayment(tx, deleted.id, 'en', deps)).toMatchObject({
				reason: 'not_found'
			});
			expect(await startMembershipPayment(tx, crypto.randomUUID(), 'en', deps)).toMatchObject({
				reason: 'not_found'
			});
			expect(await membershipsOf(tx, blocked.id)).toEqual([]);
		});
	});

	it('fee not set (0), broken fee or wait time, online payment off: unavailable, nothing created', async () => {
		await inRollback(async (tx) => {
			const user = await verifiedUser(tx);
			const deps = { provider: createMockProvider(), siteUrl: SITE };
			const broken: [unknown, unknown][] = [
				[{ ...FEE, amount_minor: 0 }, 30],
				[{ ...FEE, amount_minor: 10.5 }, 30],
				[{ ...FEE, currency: 'RUB' }, 30],
				[{ ...FEE, period_months: 0 }, 30],
				[FEE, 0],
				[FEE, '30'],
				[null, 30]
			];
			for (const [fee, wait] of broken) {
				await feeSettings(tx, fee, wait);
				expect(await startMembershipPayment(tx, user.id, 'en', deps), JSON.stringify(fee)).toEqual(
					{ ok: false, reason: 'unavailable' }
				);
			}
			await feeSettings(tx);
			expect(
				await startMembershipPayment(tx, user.id, 'en', { provider: null, siteUrl: SITE })
			).toEqual({ ok: false, reason: 'unavailable' });
			expect(await membershipsOf(tx, user.id)).toEqual([]);
			expect(await paymentsOf(tx, user.id)).toEqual([]);
		});
	});

	it('the provider does not answer: payment failed, membership stays pending (no rights)', async () => {
		await inRollback(async (tx) => {
			await feeSettings(tx);
			const user = await verifiedUser(tx);
			const result = await startMembershipPayment(tx, user.id, 'en', {
				provider: unreachableProvider(),
				siteUrl: SITE
			});
			expect(result).toMatchObject({ ok: false, reason: 'provider_error' });
			const [membership] = await membershipsOf(tx, user.id);
			expect(membership.status).toBe('pending');
			const [payment] = await paymentsOf(tx, user.id);
			expect(payment).toMatchObject({ status: 'failed', membershipId: membership.id });
		});
	});
});
