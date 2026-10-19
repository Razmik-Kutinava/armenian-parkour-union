import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { payments } from '../../db/schema/payments';
import { testDb, testDbUrl } from '../../db/test-db';
import { startMembershipPayment } from '../memberships/start';
import {
	effectsWith,
	mailbox,
	membershipsOf,
	startDeps,
	verifiedUser
} from '../memberships/test-support';
import { getMockCheckout, settleMockPayment } from './mock-pay';
import { manualProvider } from './providers/manual';
import { createMockProvider } from './providers/mock';
import { paymentRow } from './test-support';
import { testIp } from './webhook-support';

/* docs/07 section 4: the mock "bank" page in development; the result goes the webhook way. */

describe.skipIf(!testDbUrl)('payments: dev mock checkout', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	const options = () => ({ ip: testIp(), effects: effectsWith(mailbox().send) });

	async function started(tx: Parameters<Parameters<typeof inRollback>[0]>[0]) {
		const mock = createMockProvider();
		const user = await verifiedUser(tx);
		const result = await startMembershipPayment(tx, user.id, 'en', startDeps(mock));
		if (!result.ok) throw new Error(result.reason);
		const row = await paymentRow(tx, result.paymentId);
		return { mock, user, id: row.id, providerPaymentId: row.providerPaymentId! };
	}

	it('checkout shows the mock payment: kind, amount, currency, status', async () => {
		await inRollback(async (tx) => {
			const { id, providerPaymentId } = await started(tx);
			expect(await getMockCheckout(tx, providerPaymentId)).toEqual({
				id,
				kind: 'membership',
				status: 'pending',
				amountMinor: 20_000,
				currency: 'AMD'
			});
		});
	});

	it('checkout of an unknown id or of another provider’s payment — none', async () => {
		await inRollback(async (tx) => {
			const { id, providerPaymentId } = await started(tx);
			expect(await getMockCheckout(tx, 'mock_unknown')).toBeNull();
			await tx.update(payments).set({ provider: 'manual' }).where(eq(payments.id, id));
			expect(await getMockCheckout(tx, providerPaymentId)).toBeNull();
		});
	});

	it('"pay" goes through the webhook: payment paid, membership active, once even if pressed twice', async () => {
		await inRollback(async (tx) => {
			const { mock, user, id, providerPaymentId } = await started(tx);
			expect(await settleMockPayment(tx, mock, providerPaymentId, 'paid', options())).toBe('done');
			expect(await settleMockPayment(tx, mock, providerPaymentId, 'paid', options())).toBe('done');
			expect((await paymentRow(tx, id)).status).toBe('paid');
			const rows = await membershipsOf(tx, user.id);
			expect(rows.map((r) => r.status)).toEqual(['active']);
		});
	});

	it('"fail" and "cancel" set those statuses, no membership', async () => {
		await inRollback(async (tx) => {
			const first = await started(tx);
			expect(
				await settleMockPayment(tx, first.mock, first.providerPaymentId, 'failed', options())
			).toBe('done');
			expect((await paymentRow(tx, first.id)).status).toBe('failed');
			const second = await started(tx);
			await settleMockPayment(tx, second.mock, second.providerPaymentId, 'cancelled', options());
			expect((await paymentRow(tx, second.id)).status).toBe('cancelled');
			expect((await membershipsOf(tx, second.user.id)).map((r) => r.status)).toEqual(['cancelled']);
		});
	});

	it.each(['refunded', 'pending', 'paid ', ''])(
		'status %j from the form is refused',
		async (status) => {
			await inRollback(async (tx) => {
				const { mock, id, providerPaymentId } = await started(tx);
				expect(await settleMockPayment(tx, mock, providerPaymentId, status, options())).toBe(
					'invalid'
				);
				expect((await paymentRow(tx, id)).status).toBe('pending');
			});
		}
	);

	it('no mock provider here (production) or a non-mock provider — not found', async () => {
		await inRollback(async (tx) => {
			const { id, providerPaymentId } = await started(tx);
			expect(await settleMockPayment(tx, null, providerPaymentId, 'paid', options())).toBe(
				'not_found'
			);
			expect(
				await settleMockPayment(tx, manualProvider, providerPaymentId, 'paid', options())
			).toBe('not_found');
			expect((await paymentRow(tx, id)).status).toBe('pending');
		});
	});

	it('the mock forgot the payment (server restarted) — not found, nothing changes', async () => {
		await inRollback(async (tx) => {
			const { id, providerPaymentId } = await started(tx);
			const fresh = createMockProvider();
			expect(await settleMockPayment(tx, fresh, providerPaymentId, 'paid', options())).toBe(
				'not_found'
			);
			expect((await paymentRow(tx, id)).status).toBe('pending');
		});
	});
});
