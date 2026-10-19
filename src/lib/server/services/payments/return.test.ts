import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { payments } from '../../db/schema/payments';
import { testDb, testDbUrl } from '../../db/test-db';
import { countingEffects } from './apply-support';
import { startOnlinePayment } from './create';
import { PaymentProviderError, type OnlineProvider } from './providers/types';
import { ownMock, startedAt } from './reconcile-support';
import { paymentForReturn, type ReturnDeps } from './return';
import { SITE, auditOf, donationPayment, paymentRow } from './test-support';

/* docs/07 sections 1 p. 3, 7 p. 1, 15: the return page shows our status; a pending payment is
 * asked about at the provider and the answer goes the webhook way. The redirect proves nothing. */

const depsFor = (provider: OnlineProvider, extra: Partial<ReturnDeps> = {}): ReturnDeps => ({
	providerOf: (id) => (id === provider.id ? provider : null),
	allowCheck: async () => true,
	effects: {},
	...extra
});

describe.skipIf(!testDbUrl)('payments: the return page', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('not a payment id or an unknown one: null', async () => {
		await inRollback(async (tx) => {
			const { provider } = ownMock();
			for (const pid of ['', 'abc', "1' or '1'='1", crypto.randomUUID()]) {
				expect(await paymentForReturn(tx, pid, depsFor(provider))).toBeNull();
			}
		});
	});

	it('paid at the provider: paid the webhook way, effects once, log entry without an actor', async () => {
		await inRollback(async (tx) => {
			const { provider, checked } = ownMock();
			const { id, providerPaymentId } = await startedAt(tx, provider);
			provider.simulate(providerPaymentId, 'paid');
			const { calls, effects } = countingEffects();
			const view = await paymentForReturn(tx, id, depsFor(provider, { effects }));
			expect(view).toEqual({
				kind: 'membership',
				status: 'paid',
				amountMinor: 2_000_000,
				currency: 'AMD'
			});
			expect(calls).toEqual(['paid:paid']);
			expect(await auditOf(tx, id)).toMatchObject([
				{ actorId: null, action: 'payment.status', after: { status: 'paid' } }
			]);
			await paymentForReturn(tx, id, depsFor(provider, { effects }));
			expect(calls).toEqual(['paid:paid']);
			expect(checked).toEqual([providerPaymentId]);
		});
	});

	it('a forged return: still pending at the provider — stays pending, no effects', async () => {
		await inRollback(async (tx) => {
			const { provider, checked } = ownMock();
			const { id, providerPaymentId } = await startedAt(tx, provider);
			const { calls, effects } = countingEffects();
			const view = await paymentForReturn(tx, id, depsFor(provider, { effects }));
			expect(view?.status).toBe('pending');
			expect(checked).toEqual([providerPaymentId]);
			expect(calls).toEqual([]);
			expect(await paymentRow(tx, id)).toMatchObject({ status: 'pending', paidAt: null });
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
			const view = await paymentForReturn(tx, id, depsFor(provider, { effects }));
			expect(view?.status).toBe('failed');
			expect(await paymentRow(tx, id)).toMatchObject({
				failureReason: 'amount_mismatch',
				needsReview: true,
				paidAt: null
			});
			expect(calls).toEqual([]);
		});
	});

	it('the provider does not know it or does not answer: the status from the database, no error', async () => {
		await inRollback(async (tx) => {
			const { provider } = ownMock();
			const { id } = await startedAt(tx, provider);
			const errors = [new PaymentProviderError('not_found'), new PaymentProviderError('unreachable')];
			for (const error of [...errors, new Error('socket hang up')]) {
				provider.getStatus = async () => {
					throw error;
				};
				const view = await paymentForReturn(tx, id, depsFor(provider));
				expect(view?.status).toBe('pending');
			}
		});
	});

	it('not pending: neither the provider nor the rate limit is asked', async () => {
		await inRollback(async (tx) => {
			const { provider, checked } = ownMock();
			const { id, providerPaymentId } = await startedAt(tx, provider);
			await tx.update(payments).set({ status: 'cancelled' }).where(eq(payments.id, id));
			provider.simulate(providerPaymentId, 'paid');
			const allowCheck = vi.fn(async () => true);
			const view = await paymentForReturn(tx, id, depsFor(provider, { allowCheck }));
			expect(view?.status).toBe('cancelled');
			expect(checked).toEqual([]);
			expect(allowCheck).not.toHaveBeenCalled();
		});
	});

	it('over the rate limit or the provider is not available here: the status from the database', async () => {
		await inRollback(async (tx) => {
			const { provider, checked } = ownMock();
			const { id, providerPaymentId } = await startedAt(tx, provider);
			provider.simulate(providerPaymentId, 'paid');
			const limited = depsFor(provider, { allowCheck: async () => false });
			expect((await paymentForReturn(tx, id, limited))?.status).toBe('pending');
			const away = depsFor(provider, { providerOf: () => null });
			expect((await paymentForReturn(tx, id, away))?.status).toBe('pending');
			expect(checked).toEqual([]);
		});
	});

	it('a guest donation: only the kind, status and amount, no personal data', async () => {
		await inRollback(async (tx) => {
			const { provider } = ownMock();
			const result = await startOnlinePayment(tx, donationPayment(), { provider, siteUrl: SITE });
			if (!result.ok) throw new Error(result.reason);
			const row = await paymentRow(tx, result.paymentId);
			provider.simulate(row.providerPaymentId!, 'paid');
			const view = await paymentForReturn(tx, result.paymentId, depsFor(provider));
			expect(view).toEqual({
				kind: 'donation',
				status: 'paid',
				amountMinor: 500_000,
				currency: 'AMD'
			});
		});
	});
});
