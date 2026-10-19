import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { memberships } from '../../db/schema/payments';
import { users } from '../../db/schema/users';
import { testDb, testDbUrl } from '../../db/test-db';
import { startOnlinePayment } from '../payments/create';
import { createMockProvider } from '../payments/providers/mock';
import { SITE, membershipPayment, paymentRow } from '../payments/test-support';
import { startMembershipPayment } from './start';
import {
	auditFor,
	daysFromNow,
	effectsWith,
	mailbox,
	membershipRow,
	membershipsOf,
	settle,
	startDeps,
	verifiedUser
} from './test-support';

/* docs/07 sections 5.1, 8, 11 p. 3, 12 p. 1, 15; docs/03 section 2: the fee payment confirmed by
 * the provider starts or extends the membership; the letter goes after the commit. */

const MONTH_MS = 28 * 86_400_000;

describe.skipIf(!testDbUrl)('memberships: payment effects', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	async function begin(tx: Parameters<Parameters<typeof inRollback>[0]>[0], values = {}) {
		const user = await verifiedUser(tx, values);
		const provider = createMockProvider();
		const result = await startMembershipPayment(tx, user.id, 'en', startDeps(provider));
		if (!result.ok) throw new Error(result.reason);
		const [membership] = await membershipsOf(tx, user.id);
		return { user, provider, paymentId: result.paymentId, membershipId: membership.id };
	}

	it('paid: membership active for 12 months from now, level novice, audit, one letter', async () => {
		await inRollback(async (tx) => {
			const { user, provider, paymentId, membershipId } = await begin(tx);
			const { sent, send } = mailbox();
			const before = new Date();
			expect(await settle(tx, provider, paymentId, 'paid', effectsWith(send))).toBe('applied');
			const membership = await membershipRow(tx, membershipId);
			expect(membership).toMatchObject({ status: 'active', paymentId });
			expect(membership.startsAt!.getTime()).toBeGreaterThanOrEqual(before.getTime() - 5_000);
			const expectedEnd = new Date(membership.startsAt!);
			expectedEnd.setUTCMonth(expectedEnd.getUTCMonth() + 12);
			expect(Math.abs(membership.endsAt!.getTime() - expectedEnd.getTime())).toBeLessThan(
				2 * 86_400_000
			);
			const [row] = await tx.select().from(users).where(eq(users.id, user.id));
			expect(row.level).toBe('novice');
			expect((await paymentRow(tx, paymentId)).needsReview).toBe(false);
			expect(await auditFor(tx, 'membership', membershipId)).toMatchObject([
				{ actorId: null, action: 'membership.status', after: { status: 'active' } }
			]);
			expect(await auditFor(tx, 'user', user.id)).toMatchObject([
				{ actorId: null, action: 'user.level', before: { level: null }, after: { level: 'novice' } }
			]);
			expect(sent).toHaveLength(1);
			expect(sent[0].to).toBe(user.email);
			expect(sent[0].text).toContain(paymentId);
			expect(sent[0].text).toContain(`${SITE}/cabinet/membership`);
		});
	});

	it('renewal while active: the new period starts where the current one ends', async () => {
		await inRollback(async (tx) => {
			const { user, provider, paymentId, membershipId } = await begin(tx, { level: 'pro' });
			const currentEnd = daysFromNow(100);
			await tx.insert(memberships).values({
				userId: user.id,
				status: 'active',
				startsAt: daysFromNow(-265),
				endsAt: currentEnd
			});
			await settle(tx, provider, paymentId, 'paid', effectsWith(mailbox().send));
			const renewed = await membershipRow(tx, membershipId);
			expect(renewed.startsAt!.getTime()).toBe(currentEnd.getTime());
			expect(renewed.endsAt!.getTime() - currentEnd.getTime()).toBeGreaterThan(11 * MONTH_MS);
			const [row] = await tx.select().from(users).where(eq(users.id, user.id));
			expect(row.level).toBe('pro');
			expect(await auditFor(tx, 'user', user.id)).toEqual([]);
		});
	});

	it('previous membership already over: the new one starts now', async () => {
		await inRollback(async (tx) => {
			const { user, provider, paymentId, membershipId } = await begin(tx);
			await tx.insert(memberships).values({
				userId: user.id,
				status: 'expired',
				startsAt: daysFromNow(-400),
				endsAt: daysFromNow(-35)
			});
			await settle(tx, provider, paymentId, 'paid', effectsWith(mailbox().send));
			const renewed = await membershipRow(tx, membershipId);
			expect(Math.abs(renewed.startsAt!.getTime() - Date.now())).toBeLessThan(60_000);
		});
	});

	it('the same confirmation twice: one active membership, one letter', async () => {
		await inRollback(async (tx) => {
			const { user, provider, paymentId } = await begin(tx);
			const { sent, send } = mailbox();
			const { providerPaymentId } = await paymentRow(tx, paymentId);
			await settle(tx, provider, paymentId, 'paid', effectsWith(send));
			const { applyProviderStatus } = await import('../payments/apply');
			const state = await provider.getStatus(providerPaymentId!);
			const again = { provider: provider.id, providerPaymentId: providerPaymentId!, ...state };
			expect(await applyProviderStatus(tx, again, effectsWith(send))).toBe('unchanged');
			const active = (await membershipsOf(tx, user.id)).filter((m) => m.status === 'active');
			expect(active).toHaveLength(1);
			expect(sent).toHaveLength(1);
		});
	});

	it('cancelled (expired payment): pending membership closed; failed: left pending', async () => {
		await inRollback(async (tx) => {
			const cancelled = await begin(tx);
			const effects = effectsWith(mailbox().send);
			await settle(tx, cancelled.provider, cancelled.paymentId, 'cancelled', effects);
			expect((await membershipRow(tx, cancelled.membershipId)).status).toBe('cancelled');
			expect(await auditFor(tx, 'membership', cancelled.membershipId)).toMatchObject([
				{
					action: 'membership.status',
					before: { status: 'pending' },
					after: { status: 'cancelled' }
				}
			]);
			const failed = await begin(tx);
			await settle(tx, failed.provider, failed.paymentId, 'failed', effects);
			expect((await membershipRow(tx, failed.membershipId)).status).toBe('pending');
		});
	});

	it('late payment after expiry: membership activated, payment needs review', async () => {
		await inRollback(async (tx) => {
			const { provider, paymentId, membershipId } = await begin(tx);
			const { sent, send } = mailbox();
			const { expirePayment } = await import('../payments/expire');
			expect(await expirePayment(tx, paymentId, daysFromNow(1), effectsWith(send))).toBe(true);
			expect((await membershipRow(tx, membershipId)).status).toBe('cancelled');
			expect(await settle(tx, provider, paymentId, 'paid', effectsWith(send))).toBe('applied');
			expect((await membershipRow(tx, membershipId)).status).toBe('active');
			expect(await paymentRow(tx, paymentId)).toMatchObject({ status: 'paid', needsReview: true });
			expect(sent).toHaveLength(1);
		});
	});

	it('user blocked while paying: not activated, payment needs review, logged, no letter', async () => {
		await inRollback(async (tx) => {
			const { user, provider, paymentId, membershipId } = await begin(tx);
			await tx.update(users).set({ status: 'blocked' }).where(eq(users.id, user.id));
			const { sent, send } = mailbox();
			expect(await settle(tx, provider, paymentId, 'paid', effectsWith(send))).toBe('applied');
			expect((await membershipRow(tx, membershipId)).status).toBe('pending');
			expect(await paymentRow(tx, paymentId)).toMatchObject({ status: 'paid', needsReview: true });
			const [row] = await tx.select().from(users).where(eq(users.id, user.id));
			expect(row.level).toBeNull();
			expect(await auditFor(tx, 'payment', paymentId)).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						actorId: null,
						action: 'membership.not_activated',
						after: expect.objectContaining({ reason: 'user_blocked' })
					})
				])
			);
			expect(sent).toEqual([]);
		});
	});

	it('a fee payment without a membership: nothing activated, needs review', async () => {
		await inRollback(async (tx) => {
			const user = await verifiedUser(tx);
			const provider = createMockProvider();
			const result = await startOnlinePayment(tx, membershipPayment(user.id), {
				provider,
				siteUrl: SITE
			});
			if (!result.ok) throw new Error(result.reason);
			await settle(tx, provider, result.paymentId, 'paid', effectsWith(mailbox().send));
			expect(await membershipsOf(tx, user.id)).toEqual([]);
			expect((await paymentRow(tx, result.paymentId)).needsReview).toBe(true);
		});
	});

	it('refund: membership cancelled, level kept', async () => {
		await inRollback(async (tx) => {
			const { user, provider, paymentId, membershipId } = await begin(tx);
			const effects = effectsWith(mailbox().send);
			await settle(tx, provider, paymentId, 'paid', effects);
			expect(await settle(tx, provider, paymentId, 'refunded', effects)).toBe('applied');
			expect((await membershipRow(tx, membershipId)).status).toBe('cancelled');
			const [row] = await tx.select().from(users).where(eq(users.id, user.id));
			expect(row.level).toBe('novice');
		});
	});

	it('the letter fails: payment paid and membership active anyway', async () => {
		await inRollback(async (tx) => {
			const { provider, paymentId, membershipId } = await begin(tx);
			const { send } = mailbox(true);
			expect(await settle(tx, provider, paymentId, 'paid', effectsWith(send))).toBe('applied');
			expect((await paymentRow(tx, paymentId)).status).toBe('paid');
			expect((await membershipRow(tx, membershipId)).status).toBe('active');
		});
	});

	it('fee period broken at confirmation: the change rolls back, payment stays pending', async () => {
		await inRollback(async (tx) => {
			const { provider, paymentId, membershipId } = await begin(tx);
			const { sent, send } = mailbox();
			const broken = effectsWith(send, null);
			await expect(settle(tx, provider, paymentId, 'paid', broken)).rejects.toThrow();
			expect((await paymentRow(tx, paymentId)).status).toBe('pending');
			expect((await membershipRow(tx, membershipId)).status).toBe('pending');
			expect(sent).toEqual([]);
		});
	});
});
