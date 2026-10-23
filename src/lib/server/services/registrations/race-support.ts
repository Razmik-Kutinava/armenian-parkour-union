import { inArray, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { LimitDb } from '../../auth/rate-limit';
import type { UserRole } from '../../auth/session';
import { events } from '../../db/schema/events';
import { payments } from '../../db/schema/payments';
import { eventRegistrations } from '../../db/schema/registrations';
import { users } from '../../db/schema/users';
import { insertUser, testDbUrl } from '../../db/test-db';
import { insertEvent, insertMember } from './test-support';

/* Test support only: simultaneous clicks. Another session sees only committed rows, so race tests
 * commit to the test database. Afterwards their registrations and payments are deleted by id, the
 * members (`t-*@example.com`) and events are soft-deleted; ledger and audit entries stay
 * (append-only, like points/race.test.ts). */

export function raceDb(sessions = 3) {
	const clients = Array.from({ length: sessions }, () =>
		postgres(testDbUrl ?? '', { max: 1, onnotice: () => {} })
	);
	const dbs = clients.map((c) => drizzle(c));
	const [main, first, second] = dbs;
	const userIds: string[] = [];
	const eventIds: string[] = [];

	async function cleanup() {
		if (eventIds.length) {
			await main.delete(eventRegistrations).where(inArray(eventRegistrations.eventId, eventIds));
			await main.update(events).set({ deletedAt: new Date() }).where(inArray(events.id, eventIds));
		}
		if (userIds.length) {
			await main.delete(payments).where(inArray(payments.userId, userIds));
			await main.update(users).set({ deletedAt: new Date() }).where(inArray(users.id, userIds));
		}
		await Promise.all(clients.map((c) => c.end()));
	}

	async function member(values: Parameters<typeof insertMember>[1] = {}) {
		const user = await insertMember(main, values);
		userIds.push(user.id);
		return user;
	}

	async function staff(role: UserRole = 'moderator') {
		const { id } = await insertUser(main, { role });
		userIds.push(id);
		return { id, role };
	}

	async function event(extra: Parameters<typeof insertEvent>[1] = {}) {
		const row = await insertEvent(main, extra);
		eventIds.push(row.id);
		return row;
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
		throw new Error('the second click never waited for the first one');
	}

	/** `a` keeps its transaction open until `b` is seen waiting for a lock `a` holds; then both end. */
	async function race<A, B>(
		a: (tx: LimitDb) => Promise<A>,
		b: (tx: LimitDb) => Promise<B>
	): Promise<[A, B]> {
		let release!: () => void;
		const held = new Promise<void>((r) => (release = r));
		let done!: () => void;
		const firstDone = new Promise<void>((r) => (done = r));
		const firstTx = first.transaction(async (tx) => {
			const result = await a(tx);
			done();
			await held;
			return result;
		});
		let pidOf!: (pid: number) => void;
		const secondPid = new Promise<number>((r) => (pidOf = r));
		try {
			await Promise.race([firstDone, firstTx]);
			const secondTx = second.transaction(async (tx) => {
				const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
				pidOf(row.pid);
				return b(tx);
			});
			await waitsForLock(await Promise.race([secondPid, secondTx.then(() => 0)]));
			release();
			return await Promise.all([firstTx, secondTx]);
		} finally {
			release();
		}
	}

	return { dbs, main, cleanup, member, staff, event, race };
}
