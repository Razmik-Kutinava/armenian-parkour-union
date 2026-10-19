import { afterAll, describe, expect, it } from 'vitest';
import { testDb, testDbUrl } from '../../db/test-db';
import { countingEffects } from './apply-support';
import { PaymentProviderError } from './providers/types';
import { reconcilePayments } from './reconcile';
import { depsFor, later, ownMock, startedAt } from './reconcile-support';
import { auditOf, paymentRow } from './test-support';

/* docs/07 section 7 p. 2, 5: pending payments from 2 minutes to a day old are checked at the
 * provider; the answer goes through the same path as a webhook. */

describe.skipIf(!testDbUrl)('payments: reconciliation — status checks', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a payment younger than 2 minutes is not asked about yet', async () => {
		await inRollback(async (tx) => {
			const { provider, checked } = ownMock();
			const { id, providerPaymentId } = await startedAt(tx, provider);
			provider.simulate(providerPaymentId, 'paid');
			await reconcilePayments(tx, depsFor(provider, later(0)));
			expect(checked).toEqual([]);
			expect((await paymentRow(tx, id)).status).toBe('pending');
		});
	});

	it('paid at the provider: paid, effects in the same transaction, log entry without an actor', async () => {
		await inRollback(async (tx) => {
			const { provider } = ownMock();
			const { id, providerPaymentId } = await startedAt(tx, provider);
			provider.simulate(providerPaymentId, 'paid');
			const { calls, effects } = countingEffects();
			const summary = await reconcilePayments(tx, depsFor(provider, later(3), effects));
			expect(summary).toMatchObject({ checked: 1, applied: 1, expired: 0, failed: 0 });
			expect(await paymentRow(tx, id)).toMatchObject({ status: 'paid', paidAt: expect.any(Date) });
			expect(calls).toEqual(['paid:paid']);
			expect(await auditOf(tx, id)).toMatchObject([
				{ actorId: null, action: 'payment.status', after: { status: 'paid' } }
			]);
		});
	});

	it('paid with another amount: failed, needs review, no paid effect', async () => {
		await inRollback(async (tx) => {
			const { provider } = ownMock();
			const { id } = await startedAt(tx, provider);
			provider.getStatus = async () => ({
				status: 'paid',
				amountMinor: 1,
				currency: 'AMD',
				raw: {}
			});
			const { calls, effects } = countingEffects();
			await reconcilePayments(tx, depsFor(provider, later(3), effects));
			expect(await paymentRow(tx, id)).toMatchObject({
				status: 'failed',
				failureReason: 'amount_mismatch',
				needsReview: true,
				paidAt: null
			});
			expect(calls).toEqual([]);
		});
	});

	it('failed at the provider: failed; still pending and not expired: untouched', async () => {
		await inRollback(async (tx) => {
			const { provider } = ownMock();
			const failed = await startedAt(tx, provider);
			const waiting = await startedAt(tx, provider);
			provider.simulate(failed.providerPaymentId, 'failed');
			const summary = await reconcilePayments(tx, depsFor(provider, later(3)));
			expect(summary).toMatchObject({ checked: 2, applied: 1, expired: 0 });
			expect(await paymentRow(tx, failed.id)).toMatchObject({
				status: 'failed',
				failureReason: 'provider_failed'
			});
			expect((await paymentRow(tx, waiting.id)).status).toBe('pending');
			expect(await auditOf(tx, waiting.id)).toEqual([]);
		});
	});

	it('a provider not available here is skipped: no check, no change', async () => {
		await inRollback(async (tx) => {
			const { provider, checked } = ownMock();
			const { id, providerPaymentId } = await startedAt(tx, provider);
			provider.simulate(providerPaymentId, 'paid');
			const deps = { ...depsFor(provider, later(35)), providerOf: () => null };
			await reconcilePayments(tx, deps);
			expect(checked).toEqual([]);
			expect((await paymentRow(tx, id)).status).toBe('pending');
		});
	});

	it('one payment failing to check does not stop the others', async () => {
		await inRollback(async (tx) => {
			const { provider } = ownMock();
			const broken = await startedAt(tx, provider);
			const fine = await startedAt(tx, provider);
			provider.simulate(fine.providerPaymentId, 'paid');
			const getStatus = provider.getStatus;
			provider.getStatus = async (pid) => {
				if (pid === broken.providerPaymentId) throw new PaymentProviderError('unreachable');
				return getStatus(pid);
			};
			const summary = await reconcilePayments(tx, depsFor(provider, later(3)));
			expect(summary).toMatchObject({ checked: 2, applied: 1, failed: 1 });
			expect((await paymentRow(tx, broken.id)).status).toBe('pending');
			expect((await paymentRow(tx, fine.id)).status).toBe('paid');
		});
	});
});
