import { afterAll, describe, expect, it } from 'vitest';
import { donationPurposes } from '../../db/schema/payments';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { startOnlinePayment } from './create';
import { createMockProvider } from './providers/mock';
import {
	SITE,
	donationPayment,
	membershipPayment,
	paymentRow,
	paymentsOf,
	pendingMembership
} from './test-support';

/* docs/07 sections 3 p. 1, 14 p. 5: what the service refuses before any payment is recorded. */

describe.skipIf(!testDbUrl)('payments: checks before starting a payment', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a membership payment links only a pending membership of the same user', async () => {
		await inRollback(async (tx) => {
			const { id: userId } = await insertUser(tx);
			const { id: otherId } = await insertUser(tx);
			const deps = { provider: createMockProvider(), siteUrl: SITE };
			const own = await pendingMembership(tx, userId);
			const result = await startOnlinePayment(
				tx,
				membershipPayment(userId, { membershipId: own }),
				deps
			);
			if (!result.ok) throw new Error(result.reason);
			expect((await paymentRow(tx, result.paymentId)).membershipId).toBe(own);
			const foreign = await pendingMembership(tx, otherId);
			for (const membershipId of [foreign, crypto.randomUUID(), 'nope']) {
				expect(
					await startOnlinePayment(tx, membershipPayment(userId, { membershipId }), deps)
				).toEqual({ ok: false, reason: 'invalid' });
			}
			expect(await paymentsOf(tx, userId)).toHaveLength(1);
			expect(await paymentsOf(tx, otherId)).toEqual([]);
		});
	});

	it('refuses a wrong amount, currency, payer or link and writes nothing', async () => {
		await inRollback(async (tx) => {
			const { id: userId } = await insertUser(tx);
			const amdOnly = { ...createMockProvider(), currencies: ['AMD'] as const };
			const deps = { provider: createMockProvider(), siteUrl: SITE };
			const [inactive] = await tx
				.insert(donationPurposes)
				.values({ title: { en: 'Old' }, isActive: false })
				.returning({ id: donationPurposes.id });
			const donation = donationPayment().donation!;
			const wrong = [
				membershipPayment(userId, { amountMinor: 0 }),
				membershipPayment(userId, { amountMinor: -100 }),
				membershipPayment(userId, { amountMinor: 1.5 }),
				membershipPayment(userId, { amountMinor: 2 ** 53 }),
				membershipPayment(userId, { currency: 'GBP' as 'AMD' }),
				membershipPayment(userId, { holdMinutes: 0 }),
				membershipPayment(userId, { description: '' }),
				membershipPayment(null),
				donationPayment({ userId, membershipId: await pendingMembership(tx, userId) }),
				donationPayment({ userId, donation: { ...donation, purposeId: inactive.id } }),
				donationPayment({ userId, donation: { ...donation, purposeId: crypto.randomUUID() } })
			];
			for (const input of wrong) {
				expect(await startOnlinePayment(tx, input, deps), JSON.stringify(input)).toEqual({
					ok: false,
					reason: 'invalid'
				});
			}
			expect(
				await startOnlinePayment(tx, membershipPayment(userId, { currency: 'USD' }), {
					provider: amdOnly,
					siteUrl: SITE
				})
			).toEqual({ ok: false, reason: 'invalid' });
			expect(await paymentsOf(tx, userId)).toEqual([]);
		});
	});
});
