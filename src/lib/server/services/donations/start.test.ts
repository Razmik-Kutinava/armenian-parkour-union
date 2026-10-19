import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { payments } from '../../db/schema/payments';
import { users } from '../../db/schema/users';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { createMockProvider } from '../payments/providers/mock';
import { paymentRow, spiedMock, unreachableProvider } from '../payments/test-support';
import { startDonationPayment } from './start';
import { addPurpose, donationDeps, guestInput } from './test-support';

/* docs/07 sections 3, 5.2, 15 ("a donation without logging in is created"); docs/04 section 3:
 * anyone donates; the amount is the user's, so the range is checked on the server. */

describe.skipIf(!testDbUrl)('donations: starting a payment', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	const donationsBy = (tx: Parameters<Parameters<typeof inRollback>[0]>[0], email: string) =>
		tx.select().from(payments).where(eq(payments.donorEmail, email));

	it('guest: pending donation with name and email, no user; amount and currency from the limits', async () => {
		await inRollback(async (tx) => {
			const { mock, calls } = spiedMock();
			const purpose = await addPurpose(tx);
			const before = Date.now();
			const email = `guest-${crypto.randomUUID()}@example.com`;
			const result = await startDonationPayment(
				tx,
				guestInput({
					amount: '25000',
					purposeId: purpose.id,
					donorEmail: email,
					isAnonymous: true
				}),
				donationDeps(mock, { waitMinutes: 45 })
			);
			if (!result.ok) throw new Error(result.reason);
			const payment = await paymentRow(tx, result.paymentId);
			expect(payment).toMatchObject({
				kind: 'donation',
				status: 'pending',
				userId: null,
				amountMinor: 25_000,
				currency: 'AMD',
				donationPurposeId: purpose.id,
				donorName: 'Anna Guest',
				donorEmail: email,
				isAnonymous: true,
				membershipId: null
			});
			const waitMs = payment.expiresAt!.getTime() - before;
			expect(waitMs).toBeGreaterThan(44 * 60_000);
			expect(waitMs).toBeLessThan(46 * 60_000);
			expect(calls).toMatchObject([{ amountMinor: 25_000, currency: 'AMD', payerEmail: email }]);
			expect(payment.providerPayload).toMatchObject({ checkoutUrl: result.checkoutUrl });
		});
	});

	it('member: linked to the account, name and email of the form are not stored', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx);
			const { mock, calls } = spiedMock();
			const result = await startDonationPayment(
				tx,
				guestInput({ userId: user.id, donorName: 'Other', donorEmail: 'victim@example.com' }),
				donationDeps(mock)
			);
			if (!result.ok) throw new Error(result.reason);
			expect(await paymentRow(tx, result.paymentId)).toMatchObject({
				userId: user.id,
				donorName: null,
				donorEmail: null
			});
			expect(calls[0].payerEmail).toBe(user.email);
		});
	});

	it('email not confirmed is fine; every donation is a new payment', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, { emailVerified: false });
			const deps = donationDeps(createMockProvider());
			const first = await startDonationPayment(tx, guestInput({ userId: user.id }), deps);
			const second = await startDonationPayment(tx, guestInput({ userId: user.id }), deps);
			if (!first.ok || !second.ok) throw new Error('not started');
			expect(second.paymentId).not.toBe(first.paymentId);
		});
	});

	it('amount outside the limits or not a number: refused, nothing created', async () => {
		await inRollback(async (tx) => {
			const email = `range-${crypto.randomUUID()}@example.com`;
			const deps = donationDeps(createMockProvider());
			for (const amount of ['999', '1000001', '0', '', 'abc', '10.5', '-5000', '99999999999']) {
				expect(
					await startDonationPayment(tx, guestInput({ amount, donorEmail: email }), deps),
					amount
				).toEqual({ ok: false, reason: 'amount' });
			}
			expect(await donationsBy(tx, email)).toEqual([]);
			for (const amount of ['1000', '1 000 000']) {
				const result = await startDonationPayment(
					tx,
					guestInput({ amount, donorEmail: email }),
					deps
				);
				expect(result.ok, amount).toBe(true);
			}
		});
	});

	it('limits, wait time or online payment missing: unavailable, nothing created', async () => {
		await inRollback(async (tx) => {
			const email = `off-${crypto.randomUUID()}@example.com`;
			const provider = createMockProvider();
			for (const deps of [
				donationDeps(provider, { limits: null }),
				donationDeps(provider, { waitMinutes: null }),
				donationDeps(null)
			]) {
				expect(await startDonationPayment(tx, guestInput({ donorEmail: email }), deps)).toEqual({
					ok: false,
					reason: 'unavailable'
				});
			}
			expect(await donationsBy(tx, email)).toEqual([]);
		});
	});

	it('blocked or deleted member: unavailable', async () => {
		await inRollback(async (tx) => {
			const deps = donationDeps(createMockProvider());
			const blocked = await insertUser(tx, { status: 'blocked' });
			const deleted = await insertUser(tx);
			await tx.update(users).set({ deletedAt: new Date() }).where(eq(users.id, deleted.id));
			for (const userId of [blocked.id, deleted.id, crypto.randomUUID()]) {
				expect(await startDonationPayment(tx, guestInput({ userId }), deps)).toEqual({
					ok: false,
					reason: 'unavailable'
				});
			}
		});
	});

	it('hidden or unknown purpose, guest without name or email: invalid, nothing created', async () => {
		await inRollback(async (tx) => {
			const email = `bad-${crypto.randomUUID()}@example.com`;
			const deps = donationDeps(createMockProvider());
			const hidden = await addPurpose(tx, { isActive: false });
			for (const input of [
				guestInput({ purposeId: hidden.id, donorEmail: email }),
				guestInput({ purposeId: crypto.randomUUID(), donorEmail: email }),
				guestInput({ purposeId: 'not-an-id', donorEmail: email }),
				guestInput({ donorName: null, donorEmail: email }),
				guestInput({ donorName: '  ', donorEmail: email }),
				guestInput({ donorEmail: null })
			]) {
				expect(await startDonationPayment(tx, input, deps)).toEqual({
					ok: false,
					reason: 'invalid'
				});
			}
			expect(await donationsBy(tx, email)).toEqual([]);
		});
	});

	it('the provider does not answer: provider_error, the payment is failed', async () => {
		await inRollback(async (tx) => {
			const email = `down-${crypto.randomUUID()}@example.com`;
			const result = await startDonationPayment(
				tx,
				guestInput({ donorEmail: email }),
				donationDeps(unreachableProvider())
			);
			expect(result).toEqual({ ok: false, reason: 'provider_error' });
			const [payment] = await donationsBy(tx, email);
			expect(payment).toMatchObject({ status: 'failed', failureReason: 'provider_error' });
		});
	});

	it('too many donations from one address: limited, nothing created', async () => {
		await inRollback(async (tx) => {
			const email = `flood-${crypto.randomUUID()}@example.com`;
			const ip = `test-${crypto.randomUUID()}`;
			const limit = { windowMs: 60_000, max: 2 };
			const deps = donationDeps(createMockProvider(), { ip, limit });
			for (let i = 0; i < 2; i++) {
				expect((await startDonationPayment(tx, guestInput({ donorEmail: email }), deps)).ok).toBe(
					true
				);
			}
			expect(await startDonationPayment(tx, guestInput({ donorEmail: email }), deps)).toEqual({
				ok: false,
				reason: 'limited'
			});
			expect(await donationsBy(tx, email)).toHaveLength(2);
		});
	});
});
