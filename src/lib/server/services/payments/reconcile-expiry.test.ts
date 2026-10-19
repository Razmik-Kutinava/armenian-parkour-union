import { afterAll, describe, expect, it } from 'vitest';
import { testDb, testDbUrl } from '../../db/test-db';
import { applyProviderStatus } from './apply';
import { countingEffects } from './apply-support';
import type { PaymentEffects } from './effects';
import { PaymentProviderError } from './providers/types';
import { reconcilePayments } from './reconcile';
import { depsFor, later, ownMock, startedAt } from './reconcile-support';
import { auditOf, paymentRow } from './test-support';

/* docs/07 sections 7 p. 3, 5; 8; 15: an expired pending payment is cancelled only after the
 * provider says it is not paid; a payment the check cannot settle in a day goes to an admin. */

const notFound = async () => {
	throw new PaymentProviderError('not_found');
};

describe.skipIf(!testDbUrl)('payments: reconciliation — expiry', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('expired and still pending at the provider: cancelled as expired, effect, log without an actor', async () => {
		await inRollback(async (tx) => {
			const { provider } = ownMock();
			const { id } = await startedAt(tx, provider);
			const { calls, effects } = countingEffects();
			const summary = await reconcilePayments(tx, depsFor(provider, later(35), effects));
			expect(summary).toMatchObject({ checked: 1, applied: 0, expired: 1, failed: 0 });
			expect(await paymentRow(tx, id)).toMatchObject({
				status: 'cancelled',
				failureReason: 'expired'
			});
			expect(calls).toEqual(['cancelled:cancelled']);
			expect(await auditOf(tx, id)).toMatchObject([
				{
					actorId: null,
					action: 'payment.status',
					before: { status: 'pending' },
					after: { status: 'cancelled', failureReason: 'expired' }
				}
			]);
		});
	});

	it('expired and unknown to the provider: cancelled', async () => {
		await inRollback(async (tx) => {
			const { provider } = ownMock();
			const { id } = await startedAt(tx, provider);
			provider.getStatus = notFound;
			await reconcilePayments(tx, depsFor(provider, later(35)));
			expect((await paymentRow(tx, id)).status).toBe('cancelled');
		});
	});

	it('not expired and unknown to the provider: left pending', async () => {
		await inRollback(async (tx) => {
			const { provider } = ownMock();
			const { id } = await startedAt(tx, provider);
			provider.getStatus = notFound;
			await reconcilePayments(tx, depsFor(provider, later(3)));
			expect((await paymentRow(tx, id)).status).toBe('pending');
		});
	});

	it('expired but the provider does not answer: left pending (it may be paid)', async () => {
		await inRollback(async (tx) => {
			const { provider } = ownMock();
			const { id } = await startedAt(tx, provider);
			provider.getStatus = async () => {
				throw new PaymentProviderError('unreachable');
			};
			const summary = await reconcilePayments(tx, depsFor(provider, later(35)));
			expect(summary).toMatchObject({ expired: 0, failed: 1 });
			expect((await paymentRow(tx, id)).status).toBe('pending');
			expect(await auditOf(tx, id)).toEqual([]);
		});
	});

	it('expired but paid at the provider: paid, not cancelled', async () => {
		await inRollback(async (tx) => {
			const { provider } = ownMock();
			const { id, providerPaymentId } = await startedAt(tx, provider);
			provider.simulate(providerPaymentId, 'paid');
			await reconcilePayments(tx, depsFor(provider, later(35)));
			expect((await paymentRow(tx, id)).status).toBe('paid');
		});
	});

	it('a late payment after expiry still becomes paid through the provider path', async () => {
		await inRollback(async (tx) => {
			const { provider } = ownMock();
			const { id, providerPaymentId } = await startedAt(tx, provider);
			await reconcilePayments(tx, depsFor(provider, later(35)));
			provider.simulate(providerPaymentId, 'paid');
			const report = { provider: provider.id, providerPaymentId, ...(await provider.getStatus(providerPaymentId)) };
			expect(await applyProviderStatus(tx, report, {})).toBe('applied');
			expect((await paymentRow(tx, id)).status).toBe('paid');
		});
	});

	it('a failing cancel effect rolls back only that payment; the run goes on', async () => {
		await inRollback(async (tx) => {
			const { provider } = ownMock();
			const stuck = await startedAt(tx, provider);
			const other = await startedAt(tx, provider);
			const effects: PaymentEffects = {
				membership: {
					cancelled: async (_tx, payment) => {
						if (payment.id === stuck.id) throw new Error('effect failed');
					}
				}
			};
			const summary = await reconcilePayments(tx, depsFor(provider, later(35), effects));
			expect(summary).toMatchObject({ expired: 1, failed: 1 });
			expect(await paymentRow(tx, stuck.id)).toMatchObject({ status: 'pending', failureReason: null });
			expect(await auditOf(tx, stuck.id)).toEqual([]);
			expect((await paymentRow(tx, other.id)).status).toBe('cancelled');
		});
	});

	it('pending for over a day: needs review once, with a log entry; no longer checked', async () => {
		await inRollback(async (tx) => {
			const { provider, checked } = ownMock();
			const { id } = await startedAt(tx, provider);
			const deps = depsFor(provider, later(25 * 60));
			const first = await reconcilePayments(tx, deps);
			expect(first.flagged).toBeGreaterThanOrEqual(1);
			expect(await paymentRow(tx, id)).toMatchObject({ status: 'pending', needsReview: true });
			await reconcilePayments(tx, deps);
			expect(checked).toEqual([]);
			expect(await auditOf(tx, id)).toMatchObject([
				{
					actorId: null,
					before: { status: 'pending', needsReview: false },
					after: { status: 'pending', needsReview: true }
				}
			]);
		});
	});
});
