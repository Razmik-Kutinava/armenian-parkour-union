import { afterAll, describe, expect, it } from 'vitest';
import { testDb, testDbUrl } from '../../db/test-db';
import { applyProviderStatus } from './apply';
import { started } from './apply-support';
import type { PaymentEffects } from './effects';
import { expirePayment } from './expire';
import { auditOf } from './test-support';

/* docs/03 section 14, docs/07 section 5.1 p. 4: letters go after the commit; a rolled-back change
 * sends nothing, and a failing letter does not undo the payment. */

describe.skipIf(!testDbUrl)('payments: work after the commit', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('runs after the whole status change, including its log entry', async () => {
		await inRollback(async (tx) => {
			const { id, report } = await started(tx);
			const seen: number[] = [];
			const effects: PaymentEffects = {
				membership: {
					paid: async (_tx, payment, after) => {
						after(async () => {
							seen.push((await auditOf(tx, payment.id)).length);
						});
					}
				}
			};
			expect(await applyProviderStatus(tx, report('paid'), effects)).toBe('applied');
			expect(seen).toEqual([1]);
			expect(await auditOf(tx, id)).toHaveLength(1);
		});
	});

	it('not run when the change rolls back', async () => {
		await inRollback(async (tx) => {
			const { report } = await started(tx);
			const ran: string[] = [];
			const effects: PaymentEffects = {
				membership: {
					paid: async (_tx, _payment, after) => {
						after(async () => {
							ran.push('job');
						});
						throw new Error('effect failed');
					}
				}
			};
			await expect(applyProviderStatus(tx, report('paid'), effects)).rejects.toThrow();
			expect(ran).toEqual([]);
		});
	});

	it('a failing job is logged, the result stays', async () => {
		await inRollback(async (tx) => {
			const { report } = await started(tx);
			const effects: PaymentEffects = {
				membership: {
					paid: async (_tx, _payment, after) => {
						after(async () => {
							throw new Error('mail is down');
						});
					}
				}
			};
			expect(await applyProviderStatus(tx, report('paid'), effects)).toBe('applied');
		});
	});

	it('expiry runs its jobs after the commit too', async () => {
		await inRollback(async (tx) => {
			const { id } = await started(tx);
			const ran: string[] = [];
			const effects: PaymentEffects = {
				membership: {
					cancelled: async (_tx, _payment, after) => {
						after(async () => {
							ran.push('job');
						});
					}
				}
			};
			expect(await expirePayment(tx, id, new Date(Date.now() + 86_400_000), effects)).toBe(true);
			expect(ran).toEqual(['job']);
		});
	});
});
