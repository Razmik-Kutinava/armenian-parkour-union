import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { memberships, payments } from '../../db/schema/payments';
import { testDb, testDbUrl } from '../../db/test-db';
import { SITE } from '../payments/test-support';
import { runMembershipDaily } from './daily';
import { auditFor, daysFromNow, mailbox, membershipRow, verifiedUser } from './test-support';

/* docs/03 section 2 p. 4: the daily job expires memberships and writes 30 and 7 days before the
 * end; a rerun does not send the same letter again. The job sees the whole shared table, so only
 * rows of this test are checked. */

async function membership(
	tx: LimitDb,
	userId: string,
	values: Partial<typeof memberships.$inferInsert>
) {
	const [row] = await tx
		.insert(memberships)
		.values({ userId, status: 'active', ...values })
		.returning({ id: memberships.id });
	return row.id;
}

const activeUntil = (endsAt: Date) => ({
	status: 'active' as const,
	startsAt: new Date(endsAt.getTime() - 365 * 86_400_000),
	endsAt
});

describe.skipIf(!testDbUrl)('memberships: daily job', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('ended memberships expire with a log entry; current ones stay', async () => {
		await inRollback(async (tx) => {
			const user = await verifiedUser(tx);
			const ended = await membership(tx, user.id, activeUntil(daysFromNow(-1)));
			const current = await membership(tx, user.id, activeUntil(daysFromNow(200)));
			const summary = await runMembershipDaily(tx, { send: mailbox().send, siteUrl: SITE });
			expect(summary.expired).toBeGreaterThanOrEqual(1);
			expect((await membershipRow(tx, ended)).status).toBe('expired');
			expect((await membershipRow(tx, current)).status).toBe('active');
			expect(await auditFor(tx, 'membership', ended)).toMatchObject([
				{ actorId: null, before: { status: 'active' }, after: { status: 'expired' } }
			]);
		});
	});

	it('pending older than a day without a pending payment closes; others stay', async () => {
		await inRollback(async (tx) => {
			const user = await verifiedUser(tx);
			const old = daysFromNow(-2);
			const stale = await membership(tx, user.id, { status: 'pending', createdAt: old });
			const fresh = await membership(tx, user.id, { status: 'pending' });
			const waiting = await membership(tx, user.id, { status: 'pending', createdAt: old });
			await tx.insert(payments).values({
				userId: user.id,
				kind: 'membership',
				amountMinor: 20_000,
				currency: 'AMD',
				provider: 'mock',
				membershipId: waiting
			});
			const summary = await runMembershipDaily(tx, { send: mailbox().send, siteUrl: SITE });
			expect(summary.closed).toBeGreaterThanOrEqual(1);
			expect((await membershipRow(tx, stale)).status).toBe('cancelled');
			expect((await membershipRow(tx, fresh)).status).toBe('pending');
			expect((await membershipRow(tx, waiting)).status).toBe('pending');
		});
	});

	it('30 days before the end: one letter; a rerun sends nothing more', async () => {
		await inRollback(async (tx) => {
			const user = await verifiedUser(tx);
			const id = await membership(tx, user.id, activeUntil(daysFromNow(20)));
			const { sent, send } = mailbox();
			await runMembershipDaily(tx, { send, siteUrl: SITE });
			await runMembershipDaily(tx, { send, siteUrl: SITE });
			const mine = sent.filter((m) => m.to === user.email);
			expect(mine).toHaveLength(1);
			expect(mine[0].text).toContain(`${SITE}/cabinet/membership`);
			const row = await membershipRow(tx, id);
			expect(row.reminded30At).not.toBeNull();
			expect(row.reminded7At).toBeNull();
		});
	});

	it('7 days before the end: only the 7-day letter, then nothing more', async () => {
		await inRollback(async (tx) => {
			const user = await verifiedUser(tx);
			const id = await membership(tx, user.id, activeUntil(daysFromNow(5)));
			const { sent, send } = mailbox();
			await runMembershipDaily(tx, { send, siteUrl: SITE });
			await runMembershipDaily(tx, { send, siteUrl: SITE });
			expect(sent.filter((m) => m.to === user.email)).toHaveLength(1);
			const row = await membershipRow(tx, id);
			expect(row.reminded7At).not.toBeNull();
			expect(row.reminded30At).toBeNull();
		});
	});

	it('a 30-day letter already sent: the 7-day one still comes later', async () => {
		await inRollback(async (tx) => {
			const user = await verifiedUser(tx);
			const endsAt = daysFromNow(20);
			await membership(tx, user.id, activeUntil(endsAt));
			const { sent, send } = mailbox();
			await runMembershipDaily(tx, { send, siteUrl: SITE });
			await runMembershipDaily(tx, { send, siteUrl: SITE, now: daysFromNow(-6, endsAt) });
			expect(sent.filter((m) => m.to === user.email)).toHaveLength(2);
		});
	});

	it('no letter: already renewed, far from the end, blocked user', async () => {
		await inRollback(async (tx) => {
			const renewed = await verifiedUser(tx);
			const endsAt = daysFromNow(10);
			await membership(tx, renewed.id, activeUntil(endsAt));
			await membership(tx, renewed.id, {
				status: 'active',
				startsAt: endsAt,
				endsAt: daysFromNow(375)
			});
			const far = await verifiedUser(tx);
			await membership(tx, far.id, activeUntil(daysFromNow(40)));
			const blocked = await verifiedUser(tx, { status: 'blocked' });
			await membership(tx, blocked.id, activeUntil(daysFromNow(10)));
			const { sent, send } = mailbox();
			await runMembershipDaily(tx, { send, siteUrl: SITE });
			const to = new Set(sent.map((m) => m.to));
			expect(to.has(renewed.email)).toBe(false);
			expect(to.has(far.email)).toBe(false);
			expect(to.has(blocked.email)).toBe(false);
		});
	});

	it('a failing letter does not stop the run', async () => {
		await inRollback(async (tx) => {
			const user = await verifiedUser(tx);
			const ended = await membership(tx, user.id, activeUntil(daysFromNow(-1)));
			await membership(tx, user.id, activeUntil(daysFromNow(20)));
			const summary = await runMembershipDaily(tx, { send: mailbox(true).send, siteUrl: SITE });
			expect(summary.expired).toBeGreaterThanOrEqual(1);
			expect((await membershipRow(tx, ended)).status).toBe('expired');
		});
	});
});
