import { inArray, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { users } from '../../db/schema/users';
import { insertUser, testDbUrl } from '../../db/test-db';
import { appendEntry, type AppendResult, type NewEntry } from './ledger';
import { balanceOf, ledgerOf, ledgerSum } from './test-support';

/* docs/03 section 6, roadmap 4.6: two operations of one member at the same moment. The second
 * connection only sees committed rows, so these tests commit: 4 users `t-race-*` (soft-deleted
 * afterwards) and their ledger entries stay — the ledger is append-only. */

describe.skipIf(!testDbUrl)('points: concurrent writes of one member', () => {
	const clients = [1, 2, 3].map(() => postgres(testDbUrl ?? '', { max: 1, onnotice: () => {} }));
	const [main, first, second] = clients.map((c) => drizzle(c));
	const created: string[] = [];
	afterAll(async () => {
		if (created.length) {
			await main.update(users).set({ deletedAt: new Date() }).where(inArray(users.id, created));
		}
		await Promise.all(clients.map((c) => c.end()));
	});

	async function member(...entries: Omit<NewEntry, 'userId'>[]) {
		const tag = `t-race-${crypto.randomUUID()}@example.com`;
		const { id } = await insertUser(main, { email: tag });
		created.push(id);
		const ids: string[] = [];
		for (const entry of entries) {
			const result = await main.transaction((tx) => appendEntry(tx, { ...entry, userId: id }));
			if (result.status !== 'ok') throw new Error(result.status);
			ids.push(result.entry.id);
		}
		return { id, entryIds: ids };
	}

	async function waitsForLock(pid: number) {
		const deadline = Date.now() + 8_000;
		while (Date.now() < deadline) {
			const rows = await main.execute<{ wait: string | null }>(
				sql`select wait_event_type as wait from pg_stat_activity where pid = ${pid}`
			);
			if (rows[0]?.wait === 'Lock') return;
			await new Promise((r) => setTimeout(r, 50));
		}
		throw new Error('the second operation never waited for the first one');
	}

	/** The first write holds its transaction open until the second one is seen waiting for it. */
	async function race(a: NewEntry, b: NewEntry): Promise<[AppendResult, AppendResult]> {
		let release!: () => void;
		const held = new Promise<void>((r) => (release = r));
		let written!: (result: AppendResult) => void;
		const firstWritten = new Promise<AppendResult>((r) => (written = r));
		const firstTx = first.transaction(async (tx) => {
			const result = await appendEntry(tx, a);
			written(result);
			await held;
			return result;
		});
		let pidOf!: (pid: number) => void;
		const secondPid = new Promise<number>((r) => (pidOf = r));
		try {
			await Promise.race([firstWritten, firstTx]);
			const secondTx = second.transaction(async (tx) => {
				const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
				pidOf(row.pid);
				return appendEntry(tx, b);
			});
			await waitsForLock(await Promise.race([secondPid, secondTx.then(() => 0)]));
			release();
			return await Promise.all([firstTx, secondTx]);
		} finally {
			release();
		}
	}

	async function expectConsistent(userId: string, balance: number, entries: number) {
		expect(await balanceOf(main, userId)).toBe(balance);
		expect(await ledgerSum(main, userId)).toBe(balance);
		expect(await ledgerOf(main, userId)).toHaveLength(entries);
	}

	const manual = (delta: number) => ({ delta, reason: 'manual' as const, comment: 'race' });

	it('the same source twice at once: one entry, the other is a duplicate', async () => {
		const { id } = await member();
		const award: NewEntry = {
			userId: id,
			delta: 10,
			reason: 'video',
			sourceType: 'video',
			sourceId: crypto.randomUUID()
		};
		const [a, b] = await race(award, award);
		expect(a.status).toBe('ok');
		expect(b).toEqual({ status: 'duplicate' });
		await expectConsistent(id, 10, 1);
	});

	it('two charges that together exceed the balance: the second is refused, not below zero', async () => {
		const { id } = await member(manual(100));
		const [a, b] = await race({ userId: id, ...manual(-80) }, { userId: id, ...manual(-80) });
		expect(a).toMatchObject({ status: 'ok', balanceBefore: 100, balanceAfter: 20 });
		expect(b).toEqual({ status: 'insufficient_balance' });
		await expectConsistent(id, 20, 2);
	});

	it('one entry reversed twice at once: one reversal, the other is a duplicate', async () => {
		const { id, entryIds } = await member(manual(100), manual(500));
		const reversal: NewEntry = {
			userId: id,
			delta: -100,
			reason: 'reversal',
			comment: 'race',
			reversalOfId: entryIds[0]
		};
		const [a, b] = await race(reversal, reversal);
		expect(a).toMatchObject({ status: 'ok', balanceAfter: 500 });
		expect(b).toEqual({ status: 'duplicate' });
		await expectConsistent(id, 500, 3);
	});

	it('two different awards at once: both written, the balance is their sum', async () => {
		const { id } = await member();
		const award = (delta: number): NewEntry => ({
			userId: id,
			delta,
			reason: 'event_participation',
			sourceType: 'event_registration',
			sourceId: crypto.randomUUID()
		});
		const [a, b] = await race(award(20), award(30));
		expect(a).toMatchObject({ status: 'ok', balanceAfter: 20 });
		expect(b).toMatchObject({ status: 'ok', balanceBefore: 20, balanceAfter: 50 });
		await expectConsistent(id, 50, 2);
	});
});
