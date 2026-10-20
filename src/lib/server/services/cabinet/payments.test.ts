import { afterAll, describe, expect, it } from 'vitest';
import { memberships } from '../../db/schema/payments';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { addPurpose } from '../donations/test-support';
import { daysFromNow } from '../memberships/test-support';
import { insertPayment } from '../payments/admin/test-support';
import { listOwnPayments } from './payments';
import { getOwnReceipt } from './receipt';

/* docs/06 section 5.9, docs/07 section 12 p. 1: own payments and a copy of the receipt;
 * docs/04 section 5.3: another member's payment is "not found". */

describe.skipIf(!testDbUrl)('cabinet: payments and receipts', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('lists only own payments, newest first, receipt only when paid or refunded', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx);
			const other = await insertUser(tx);
			const old = await insertPayment(tx, {
				userId: user.id,
				status: 'paid',
				paidAt: daysFromNow(-10),
				createdAt: daysFromNow(-10)
			});
			const failed = await insertPayment(tx, {
				userId: user.id,
				kind: 'membership',
				status: 'failed',
				createdAt: daysFromNow(-5)
			});
			const refunded = await insertPayment(tx, {
				userId: user.id,
				status: 'refunded',
				paidAt: daysFromNow(-3),
				refundedAt: daysFromNow(-1),
				createdAt: daysFromNow(-3)
			});
			await insertPayment(tx, { userId: other.id, status: 'paid', paidAt: new Date() });
			await insertPayment(tx, { userId: null, status: 'paid', paidAt: new Date() });

			const list = await listOwnPayments(tx, user.id);
			expect(list.map((p) => p.id)).toEqual([refunded.id, failed.id, old.id]);
			expect(list.map((p) => p.hasReceipt)).toEqual([true, false, true]);
			expect(list[1]).toMatchObject({
				kind: 'membership',
				status: 'failed',
				amountMinor: 5000,
				currency: 'AMD'
			});
			expect(list[0]).not.toHaveProperty('donorEmail');
		});
	});

	it('malformed id: empty list', async () => {
		await inRollback(async (tx) => {
			expect(await listOwnPayments(tx, 'nope')).toEqual([]);
		});
	});

	it('receipt of a paid fee: number, date, amount, period, payer', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, { name: 'Lilit Petrosyan' });
			const paidAt = daysFromNow(-2);
			const payment = await insertPayment(tx, {
				userId: user.id,
				kind: 'membership',
				status: 'paid',
				amountMinor: 20_000,
				paidAt
			});
			const [membership] = await tx
				.insert(memberships)
				.values({
					userId: user.id,
					status: 'active',
					startsAt: paidAt,
					endsAt: daysFromNow(363),
					paymentId: payment.id
				})
				.returning();
			const receipt = await getOwnReceipt(tx, user.id, payment.id, 'en');
			expect(receipt).toMatchObject({
				id: payment.id,
				kind: 'membership',
				status: 'paid',
				amountMinor: 20_000,
				currency: 'AMD',
				paidAt,
				refundedAt: null,
				payerName: 'Lilit Petrosyan',
				purpose: null,
				period: { startsAt: membership.startsAt, endsAt: membership.endsAt }
			});
			expect(receipt).toHaveProperty('requisites');
		});
	});

	it('receipt of a donation: the purpose in the language, or general needs', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx);
			const purpose = await addPurpose(tx);
			const withPurpose = await insertPayment(tx, {
				userId: user.id,
				status: 'paid',
				paidAt: new Date(),
				donationPurposeId: purpose.id
			});
			const general = await insertPayment(tx, {
				userId: user.id,
				status: 'refunded',
				paidAt: daysFromNow(-3),
				refundedAt: daysFromNow(-1)
			});
			expect((await getOwnReceipt(tx, user.id, withPurpose.id, 'ru'))?.purpose).toBe('Паркур-парк');
			const refunded = await getOwnReceipt(tx, user.id, general.id, 'en');
			expect(refunded?.purpose).toBe('General needs of the federation');
			expect(refunded?.status).toBe('refunded');
			expect(refunded?.refundedAt).toBeInstanceOf(Date);
			expect(refunded?.period).toBeNull();
		});
	});

	it('no receipt: another member’s, unpaid, unknown or malformed id', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx);
			const other = await insertUser(tx);
			const foreign = await insertPayment(tx, {
				userId: other.id,
				status: 'paid',
				paidAt: new Date()
			});
			const pending = await insertPayment(tx, { userId: user.id, status: 'pending' });
			const cancelled = await insertPayment(tx, { userId: user.id, status: 'cancelled' });
			expect(await getOwnReceipt(tx, user.id, foreign.id, 'en')).toBeNull();
			expect(await getOwnReceipt(tx, user.id, pending.id, 'en')).toBeNull();
			expect(await getOwnReceipt(tx, user.id, cancelled.id, 'en')).toBeNull();
			expect(await getOwnReceipt(tx, user.id, crypto.randomUUID(), 'en')).toBeNull();
			expect(await getOwnReceipt(tx, user.id, 'nope', 'en')).toBeNull();
		});
	});
});
