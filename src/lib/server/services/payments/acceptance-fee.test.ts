import { afterAll, describe, expect, it } from 'vitest';
import { testDb, testDbUrl } from '../../db/test-db';
import { auditFor, membershipsOf } from '../memberships/test-support';
import {
	deliver,
	feeStarted,
	onlyProvider,
	productionEffects,
	userRow
} from './acceptance-support';
import { createMockProvider } from './providers/mock';
import { reconcilePayments } from './reconcile';
import { later, ownMock } from './reconcile-support';
import { paymentForReturn } from './return';
import { paymentRow } from './test-support';

/* docs/07 section 15, the fee chain on mock with the production effects: what the provider or a
 * visitor sends never pays twice and never pays without the provider. */

describe.skipIf(!testDbUrl)('payments acceptance: membership fee', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a duplicate webhook: one active membership, novice once, no points, one letter', async () => {
		await inRollback(async (tx) => {
			const mock = createMockProvider();
			const { sent, effects } = productionEffects();
			const { user, payment } = await feeStarted(tx, mock);
			const paid = mock.simulate(payment.providerPaymentId!, 'paid');
			const again = mock.simulate(payment.providerPaymentId!, 'paid');
			for (const notice of [paid, paid, again]) {
				expect(await deliver(tx, mock, notice, effects)).toBe(200);
			}
			expect((await paymentRow(tx, payment.id)).status).toBe('paid');
			expect((await membershipsOf(tx, user.id)).map((m) => m.status)).toEqual(['active']);
			expect(await userRow(tx, user.id)).toMatchObject({ level: 'novice', pointsBalance: 0 });
			const levels = (await auditFor(tx, 'user', user.id)).filter((e) => e.action === 'user.level');
			expect(levels).toHaveLength(1);
			expect(sent.map((m) => m.to)).toEqual([user.email]);
		});
	});

	it('a forged signature or another amount or currency: nothing is activated', async () => {
		await inRollback(async (tx) => {
			const mock = createMockProvider();
			const { sent, effects } = productionEffects();
			const forged = await feeStarted(tx, mock);
			const real = mock.simulate(forged.payment.providerPaymentId!, 'paid');
			const tampered = { headers: real.headers, body: real.body.replace('"paid"', '"paid" ') };
			expect(await deliver(tx, mock, tampered, effects)).toBe(400);
			expect((await paymentRow(tx, forged.payment.id)).status).toBe('pending');

			const payers = [forged.user];
			for (const override of [{ amountMinor: 1 }, { currency: 'USD' }]) {
				const { user, payment } = await feeStarted(tx, mock);
				payers.push(user);
				const notice = mock.simulate(payment.providerPaymentId!, 'paid', override);
				expect(await deliver(tx, mock, notice, effects)).toBe(200);
				expect(await paymentRow(tx, payment.id)).toMatchObject({
					status: 'failed',
					failureReason: 'amount_mismatch',
					needsReview: true
				});
				expect((await paymentRow(tx, payment.id)).paidAt).toBeNull();
			}
			for (const user of payers) {
				expect((await membershipsOf(tx, user.id)).map((m) => m.status)).toEqual(['pending']);
				expect((await userRow(tx, user.id)).level).toBeNull();
			}
			expect(sent).toEqual([]);
		});
	});

	it('a forged return to /payment/success pays nothing; the real payment then pays once', async () => {
		await inRollback(async (tx) => {
			const mock = createMockProvider();
			const { sent, effects } = productionEffects();
			const { user, payment } = await feeStarted(tx, mock);
			const deps = { providerOf: onlyProvider(mock), allowCheck: async () => true, effects };
			expect((await paymentForReturn(tx, payment.id, deps))?.status).toBe('pending');
			expect((await membershipsOf(tx, user.id)).map((m) => m.status)).toEqual(['pending']);
			expect(sent).toEqual([]);

			const notice = mock.simulate(payment.providerPaymentId!, 'paid');
			expect((await paymentForReturn(tx, payment.id, deps))?.status).toBe('paid');
			expect(await deliver(tx, mock, notice, effects)).toBe(200);
			expect((await membershipsOf(tx, user.id)).map((m) => m.status)).toEqual(['active']);
			expect(sent.map((m) => m.to)).toEqual([user.email]);
		});
	});

	it('an expired fee payment: reconciliation cancels it and closes the pending membership', async () => {
		await inRollback(async (tx) => {
			const { provider } = ownMock();
			const { sent, effects } = productionEffects();
			const { user, payment } = await feeStarted(tx, provider);
			const deps = { providerOf: onlyProvider(provider), now: later(35), effects };
			expect(await reconcilePayments(tx, deps)).toMatchObject({ expired: 1, failed: 0 });
			expect(await paymentRow(tx, payment.id)).toMatchObject({
				status: 'cancelled',
				failureReason: 'expired',
				paidAt: null
			});
			expect((await membershipsOf(tx, user.id)).map((m) => m.status)).toEqual(['cancelled']);
			expect((await userRow(tx, user.id)).level).toBeNull();
			expect(sent).toEqual([]);
		});
	});
});
