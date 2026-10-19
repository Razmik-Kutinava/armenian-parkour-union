import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { payments } from '../../db/schema/payments';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { applyProviderStatus, type ProviderReport } from './apply';
import { startOnlinePayment } from './create';
import type { PaymentEffects } from './effects';
import { createMockProvider } from './providers/mock';
import { SITE, auditOf, donationPayment, membershipPayment, paymentRow } from './test-support';

/* docs/07 sections 6 (p. 2.4-2.7, 5), 8, 10: one path for every confirmation from a provider. */

describe.skipIf(!testDbUrl)('payments: applying a status from the provider', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	async function started(tx: LimitDb, kind: 'membership' | 'donation' = 'membership') {
		const input = kind === 'membership' ? membershipPayment((await insertUser(tx)).id) : donationPayment();
		const result = await startOnlinePayment(tx, input, {
			provider: createMockProvider(),
			siteUrl: SITE
		});
		if (!result.ok) throw new Error(result.reason);
		const row = await paymentRow(tx, result.paymentId);
		const report = (status: ProviderReport['status'], extra: Partial<ProviderReport> = {}) => ({
			provider: 'mock',
			providerPaymentId: row.providerPaymentId!,
			status,
			amountMinor: row.amountMinor,
			currency: row.currency,
			raw: { status },
			...extra
		});
		return { id: row.id, report };
	}

	function countingEffects() {
		const calls: string[] = [];
		const effect = (name: string) => async (tx: LimitDb, payment: { id: string }) => {
			const [row] = await tx.select().from(payments).where(eq(payments.id, payment.id));
			calls.push(`${name}:${row.status}`);
		};
		const effects: PaymentEffects = {
			membership: { paid: effect('paid'), refunded: effect('refunded'), cancelled: effect('cancelled') }
		};
		return { calls, effects };
	}

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
			expect(await applyProviderStatus(tx, report('paid', { providerPaymentId: 'mock_none' }), {})).toBe(
				'not_found'
			);
			expect(await applyProviderStatus(tx, report('paid', { provider: 'other' }), {})).toBe(
				'not_found'
			);
			expect((await paymentRow(tx, id)).status).toBe('pending');
			expect(await auditOf(tx, id)).toEqual([]);
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
			await expect(applyProviderStatus(tx, report('paid'), effects)).rejects.toThrow('effect failed');
			expect(await paymentRow(tx, id)).toMatchObject({ status: 'pending', paidAt: null });
			expect(await auditOf(tx, id)).toEqual([]);
			expect(await applyProviderStatus(tx, report('paid'), {})).toBe('applied');
		});
	});
});
