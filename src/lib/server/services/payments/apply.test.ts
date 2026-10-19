import { afterAll, describe, expect, it } from 'vitest';
import { testDb, testDbUrl } from '../../db/test-db';
import { applyProviderStatus } from './apply';
import { countingEffects, started } from './apply-support';
import type { PaymentEffects } from './effects';
import { auditOf, paymentRow } from './test-support';

/* docs/07 sections 6 (p. 2.6-2.7, 5), 8, 10: one path for every confirmation from a provider. */

describe.skipIf(!testDbUrl)('payments: applying a status from the provider', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('paid: status, paid_at, effects inside the same transaction, log entry without an actor', async () => {
		await inRollback(async (tx) => {
			const { id, report } = await started(tx);
			const { calls, effects } = countingEffects();
			expect(await applyProviderStatus(tx, report('paid'), effects)).toBe('applied');
			const row = await paymentRow(tx, id);
			expect(row.status).toBe('paid');
			expect(row.paidAt).toBeInstanceOf(Date);
			expect(row.providerPayload).toMatchObject({
				checkoutUrl: expect.any(String),
				last: { status: 'paid' }
			});
			expect(calls).toEqual(['paid:paid']);
			const audit = await auditOf(tx, id);
			expect(audit).toHaveLength(1);
			expect(audit[0]).toMatchObject({
				actorId: null,
				action: 'payment.status',
				before: { status: 'pending' },
				after: { status: 'paid' }
			});
		});
	});

	it('the same confirmation twice changes nothing the second time', async () => {
		await inRollback(async (tx) => {
			const { id, report } = await started(tx);
			const { calls, effects } = countingEffects();
			expect(await applyProviderStatus(tx, report('paid'), effects)).toBe('applied');
			const paidAt = (await paymentRow(tx, id)).paidAt;
			expect(await applyProviderStatus(tx, report('paid'), effects)).toBe('unchanged');
			expect((await paymentRow(tx, id)).paidAt).toEqual(paidAt);
			expect(calls).toEqual(['paid:paid']);
			expect(await auditOf(tx, id)).toHaveLength(1);
		});
	});

	it('a late paid does not overwrite refunded; refunded is final', async () => {
		await inRollback(async (tx) => {
			const { id, report } = await started(tx);
			const { calls, effects } = countingEffects();
			await applyProviderStatus(tx, report('paid'), effects);
			expect(await applyProviderStatus(tx, report('refunded'), effects)).toBe('applied');
			expect((await paymentRow(tx, id)).refundedAt).toBeInstanceOf(Date);
			for (const status of ['paid', 'failed', 'cancelled'] as const) {
				expect(await applyProviderStatus(tx, report(status), effects)).toBe('ignored');
			}
			expect((await paymentRow(tx, id)).status).toBe('refunded');
			expect(calls).toEqual(['paid:paid', 'refunded:refunded']);
			expect(await auditOf(tx, id)).toHaveLength(2);
		});
	});

	it('failed and cancelled may still become paid; paid never becomes failed or cancelled', async () => {
		await inRollback(async (tx) => {
			const failed = await started(tx);
			expect(await applyProviderStatus(tx, failed.report('failed', { amountMinor: 0 }), {})).toBe(
				'applied'
			);
			expect(await paymentRow(tx, failed.id)).toMatchObject({
				status: 'failed',
				failureReason: 'provider_failed'
			});
			expect(await applyProviderStatus(tx, failed.report('paid'), {})).toBe('applied');
			for (const status of ['failed', 'cancelled'] as const) {
				expect(await applyProviderStatus(tx, failed.report(status), {})).toBe('ignored');
			}
			expect((await paymentRow(tx, failed.id)).status).toBe('paid');

			const cancelled = await started(tx);
			expect(await applyProviderStatus(tx, cancelled.report('cancelled'), {})).toBe('applied');
			expect(await applyProviderStatus(tx, cancelled.report('refunded'), {})).toBe('ignored');
			expect(await applyProviderStatus(tx, cancelled.report('paid'), {})).toBe('applied');
			expect((await paymentRow(tx, cancelled.id)).status).toBe('paid');
		});
	});

	it('pending from a status check changes nothing', async () => {
		await inRollback(async (tx) => {
			const { id, report } = await started(tx);
			expect(await applyProviderStatus(tx, report('pending'), {})).toBe('unchanged');
			expect((await paymentRow(tx, id)).status).toBe('pending');
			expect(await auditOf(tx, id)).toEqual([]);
		});
	});

	it('a failing effect rolls everything back: still pending, no log entry, error goes up', async () => {
		await inRollback(async (tx) => {
			const { id, report } = await started(tx);
			const effects: PaymentEffects = {
				membership: {
					paid: async () => {
						throw new Error('effect failed');
					}
				}
			};
			await expect(applyProviderStatus(tx, report('paid'), effects)).rejects.toThrow(
				'effect failed'
			);
			expect(await paymentRow(tx, id)).toMatchObject({ status: 'pending', paidAt: null });
			expect(await auditOf(tx, id)).toEqual([]);
			expect(await applyProviderStatus(tx, report('paid'), {})).toBe('applied');
		});
	});
});
