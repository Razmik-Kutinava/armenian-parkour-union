import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { memberships, payments } from '../../db/schema/payments';
import { testDb, testDbUrl } from '../../db/test-db';
import { createMockProvider } from '../payments/providers/mock';
import { getMembershipOverview } from './overview';
import { startMembershipPayment } from './start';
import { daysFromNow, startDeps, verifiedUser } from './test-support';

/* docs/06 section 5.3: status, period, history and "awaiting payment confirmation" — own rows only. */

type Status = 'pending' | 'active' | 'expired' | 'cancelled';

async function period(tx: LimitDb, userId: string, status: Status, from: number, to: number) {
	const [row] = await tx
		.insert(memberships)
		.values({ userId, status, startsAt: daysFromNow(from), endsAt: daysFromNow(to) })
		.returning();
	return row;
}

describe.skipIf(!testDbUrl)('memberships: overview for the cabinet and /join', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('no memberships: not a member, nothing waiting, empty history', async () => {
		await inRollback(async (tx) => {
			const user = await verifiedUser(tx);
			expect(await getMembershipOverview(tx, user.id)).toEqual({
				active: false,
				paidUntil: null,
				waiting: false,
				history: []
			});
		});
	});

	it('active now with a renewal ahead: paid until the end of the renewal, newest first', async () => {
		await inRollback(async (tx) => {
			const user = await verifiedUser(tx);
			const old = await period(tx, user.id, 'expired', -400, -35);
			const now = await period(tx, user.id, 'active', -35, 330);
			const next = await period(tx, user.id, 'active', 330, 695);
			const overview = await getMembershipOverview(tx, user.id);
			expect(overview.active).toBe(true);
			expect(overview.paidUntil).toEqual(next.endsAt);
			expect(overview.waiting).toBe(false);
			expect(overview.history.map((h) => h.status)).toEqual(['active', 'active', 'expired']);
			expect(overview.history.map((h) => h.endsAt)).toEqual([next.endsAt, now.endsAt, old.endsAt]);
		});
	});

	it('only expired or refunded periods: not a member, both in the history', async () => {
		await inRollback(async (tx) => {
			const user = await verifiedUser(tx);
			await period(tx, user.id, 'expired', -400, -35);
			await period(tx, user.id, 'cancelled', -30, 335);
			const overview = await getMembershipOverview(tx, user.id);
			expect(overview).toMatchObject({ active: false, paidUntil: null, waiting: false });
			expect(overview.history.map((h) => h.status)).toEqual(['cancelled', 'expired']);
		});
	});

	it('an active row past its end (daily job not run yet) is not a membership', async () => {
		await inRollback(async (tx) => {
			const user = await verifiedUser(tx);
			await period(tx, user.id, 'active', -400, -1);
			expect(await getMembershipOverview(tx, user.id)).toMatchObject({
				active: false,
				paidUntil: null
			});
		});
	});

	it('a started payment is "waiting" until it expires; the pending row is not in the history', async () => {
		await inRollback(async (tx) => {
			const user = await verifiedUser(tx);
			const started = await startMembershipPayment(
				tx,
				user.id,
				'en',
				startDeps(createMockProvider())
			);
			if (!started.ok) throw new Error(started.reason);
			expect(await getMembershipOverview(tx, user.id)).toMatchObject({
				active: false,
				waiting: true,
				history: []
			});
			await tx
				.update(payments)
				.set({ expiresAt: daysFromNow(-1) })
				.where(eq(payments.id, started.paymentId));
			expect((await getMembershipOverview(tx, user.id)).waiting).toBe(false);
		});
	});

	it('another member’s memberships are not seen', async () => {
		await inRollback(async (tx) => {
			const user = await verifiedUser(tx);
			const other = await verifiedUser(tx);
			await period(tx, other.id, 'active', -10, 355);
			await startMembershipPayment(tx, other.id, 'en', startDeps(createMockProvider()));
			expect(await getMembershipOverview(tx, user.id)).toEqual({
				active: false,
				paidUntil: null,
				waiting: false,
				history: []
			});
		});
	});

	it('a malformed user id is just an empty overview', async () => {
		await inRollback(async (tx) => {
			expect((await getMembershipOverview(tx, 'nope')).history).toEqual([]);
		});
	});
});
