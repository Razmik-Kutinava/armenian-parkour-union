import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { memberships, payments } from '../../db/schema/payments';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { appendEntry } from '../points/ledger';
import { recentUsers, shortStats, suspiciousWeek } from './admin';

/* docs/05 section 3, admin-only blocks: the last 10 sign-ups, suspicious points of the last 7 days
 * (thresholds `points_suspicious`, decisions.md 2026-10-21) and short statistics. */

const DAY = 86_400_000;
const later = () => new Date(Date.now() + 60_000);

describe.skipIf(!testDbUrl)('dashboard: last sign-ups', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('newest first with name and email, ten at most, deleted ones skipped', async () => {
		await inRollback(async (tx) => {
			const gone = await insertUser(tx, { createdAt: later(), deletedAt: new Date() });
			const user = await insertUser(tx, { createdAt: later() });
			const list = await recentUsers(tx);
			expect(list.length).toBeLessThanOrEqual(10);
			expect(list[0]).toMatchObject({ id: user.id, email: user.email, name: `Test ${user.tag}` });
			expect(list.map((u) => u.id)).not.toContain(gone.id);
		});
	});
});

describe.skipIf(!testDbUrl)('dashboard: suspicious points', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	const entry = (userId: string, delta: number, createdAt: Date) => ({
		userId,
		delta,
		reason: 'event_place' as const,
		sourceType: 'test',
		sourceId: crypto.randomUUID(),
		createdAt
	});

	it('a large entry of this week counts; an old or a small one does not', async () => {
		await inRollback(async (tx) => {
			const before = (await suspiciousWeek(tx)).total;
			const user = await insertUser(tx);
			const big = await appendEntry(tx, entry(user.id, 500, later()));
			await appendEntry(tx, entry(user.id, 5, later()));
			await appendEntry(tx, entry(user.id, 500, new Date(Date.now() - 8 * DAY)));
			const week = await suspiciousWeek(tx);
			expect(week.total).toBe(before + 1);
			expect(week.rows.length).toBeLessThanOrEqual(5);
			expect(week.rows[0]).toMatchObject({
				id: big.status === 'ok' ? big.entry.id : '',
				userId: user.id,
				delta: 500,
				reason: 'event_place'
			});
			expect(week.href).toMatch(/^\/admin\/points\?suspicious=1&from=\d{4}-\d{2}-\d{2}$/);
		});
	});
});

describe.skipIf(!testDbUrl)('dashboard: short statistics', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	const paid = (tx: LimitDb, userId: string, kind: 'membership' | 'donation', paidAt: Date) =>
		tx
			.insert(payments)
			.values({
				userId,
				kind,
				status: 'paid',
				amountMinor: 1000,
				currency: 'AMD',
				provider: 'manual',
				paidAt
			})
			.returning();
	const sumOf = (s: Awaited<ReturnType<typeof shortStats>>, kind: string) =>
		s.payments.find((p) => p.kind === kind && p.currency === 'AMD') ?? { count: 0, amountMinor: 0 };

	it('users, active memberships by person, paid payments of this month by kind', async () => {
		await inRollback(async (tx) => {
			const before = await shortStats(tx);
			const user = await insertUser(tx);
			const [fee] = await paid(tx, user.id, 'membership', new Date());
			await paid(tx, user.id, 'donation', new Date(Date.now() - 40 * DAY));
			await tx.insert(payments).values({
				userId: user.id,
				kind: 'donation',
				amountMinor: 500,
				currency: 'AMD',
				provider: 'manual'
			});
			const now = Date.now();
			await tx.insert(memberships).values([
				{
					userId: user.id,
					status: 'active',
					startsAt: new Date(now - DAY),
					endsAt: new Date(now + DAY),
					paymentId: fee.id
				},
				{
					userId: user.id,
					status: 'active',
					startsAt: new Date(now - DAY),
					endsAt: new Date(now + 2 * DAY)
				},
				{
					userId: user.id,
					status: 'expired',
					startsAt: new Date(now - 9 * DAY),
					endsAt: new Date(now - DAY)
				}
			]);
			const after = await shortStats(tx);
			expect(after.users).toBe(before.users + 1);
			expect(after.activeMembers).toBe(before.activeMembers + 1);
			expect(sumOf(after, 'membership')).toMatchObject({
				count: sumOf(before, 'membership').count + 1,
				amountMinor: sumOf(before, 'membership').amountMinor + 1000
			});
			expect(sumOf(after, 'donation')).toEqual(sumOf(before, 'donation'));
		});
	});
});
