import { afterAll, describe, expect, it } from 'vitest';
import { testDb, testDbUrl } from '../../db/test-db';
import { applyProviderStatus } from './apply';
import { countingEffects, started } from './apply-support';
import { auditOf, paymentRow } from './test-support';

/* docs/07 section 1 p. 4, section 6 p. 2.4-2.5, section 8: what a confirmation must match. */

describe.skipIf(!testDbUrl)('payments: checking a confirmation from the provider', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a wrong amount or currency never marks paid: the payment fails for review, no effects', async () => {
		await inRollback(async (tx) => {
			const { calls, effects } = countingEffects();
			for (const wrong of [{ amountMinor: 1_999_999 }, { currency: 'USD' }]) {
				const { id, report } = await started(tx);
				expect(await applyProviderStatus(tx, report('paid', wrong), effects)).toBe('mismatch');
				expect(await paymentRow(tx, id)).toMatchObject({
					status: 'failed',
					failureReason: 'amount_mismatch',
					needsReview: true,
					paidAt: null
				});
				const audit = await auditOf(tx, id);
				expect(audit).toHaveLength(1);
				expect(audit[0].after).toMatchObject({
					status: 'failed',
					failureReason: 'amount_mismatch',
					needsReview: true
				});
				expect(await applyProviderStatus(tx, report('paid', wrong), effects)).toBe('mismatch');
				expect((await paymentRow(tx, id)).status).toBe('failed');
			}
			expect(calls).toEqual([]);
		});
	});

	it('a wrong amount on a paid payment flags it for review and keeps it paid', async () => {
		await inRollback(async (tx) => {
			const { id, report } = await started(tx, 'donation');
			await applyProviderStatus(tx, report('paid'), {});
			expect(await applyProviderStatus(tx, report('refunded', { amountMinor: 100 }), {})).toBe(
				'mismatch'
			);
			expect(await paymentRow(tx, id)).toMatchObject({
				status: 'paid',
				needsReview: true,
				refundedAt: null
			});
			expect(await auditOf(tx, id)).toHaveLength(2);
		});
	});

	it('an unknown payment is not found and nothing is written', async () => {
		await inRollback(async (tx) => {
			const { id, report } = await started(tx);
			expect(
				await applyProviderStatus(tx, report('paid', { providerPaymentId: 'mock_none' }), {})
			).toBe('not_found');
			expect(await applyProviderStatus(tx, report('paid', { provider: 'other' }), {})).toBe(
				'not_found'
			);
			expect((await paymentRow(tx, id)).status).toBe('pending');
			expect(await auditOf(tx, id)).toEqual([]);
		});
	});
});
