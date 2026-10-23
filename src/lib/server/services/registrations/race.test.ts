import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { testDbUrl } from '../../db/test-db';
import { cancelRegistration } from './cancel';
import { raceDb } from './race-support';
import { registerForEvent } from './register';
import { SEAT_STATUSES } from './seats';
import { SETTINGS, cancelDeps, insertCategory, registrationsOf } from './test-support';

/* docs/03 section 7.3, roadmap 5.10: the limit is checked inside the transaction under the event
 * row lock, so simultaneous clicks never take more seats than there are, and the rest wait in line
 * in the order they got the lock. These tests commit (race-support.ts). */

const register = (tx: LimitDb, userId: string, eventId: string, categoryId: string | null = null) =>
	registerForEvent(tx, userId, { eventId, categoryId }, { settings: SETTINGS });

describe.skipIf(!testDbUrl)('registrations: simultaneous clicks', () => {
	const db = raceDb(7);
	afterAll(db.cleanup);

	const rowsOf = (eventId: string) => registrationsOf(db.main, eventId);
	const seatsTaken = async (eventId: string) =>
		(await rowsOf(eventId)).filter((r) => SEAT_STATUSES.includes(r.status)).length;
	const members = (n: number) => Promise.all(Array.from({ length: n }, () => db.member()));

	it('the last seat, two members at once: one gets it, the other waits in line', async () => {
		const event = await db.event({ capacity: 1 });
		const [a, b] = await members(2);
		const [first, second] = await db.race(
			(tx) => register(tx, a.id, event.id),
			(tx) => register(tx, b.id, event.id)
		);
		expect(first).toMatchObject({ ok: true, status: 'registered' });
		expect(second).toMatchObject({ ok: true, status: 'waitlist' });
		expect(await seatsTaken(event.id)).toBe(1);
	});

	it('six members at once on two seats: two registered, four in line after them', async () => {
		const event = await db.event({ capacity: 2 });
		const sessions = db.dbs.slice(1);
		const people = await members(sessions.length);
		const results = await Promise.all(sessions.map((s, i) => register(s, people[i].id, event.id)));
		const statuses = results.map((r) => (r.ok ? r.status : r.reason)).sort();
		expect(statuses).toEqual(['registered', 'registered', ...Array(4).fill('waitlist')]);
		expect((await rowsOf(event.id)).map((r) => r.status)).toEqual([
			'registered',
			'registered',
			...Array(4).fill('waitlist')
		]);
	});

	it('the last seat of a category at once: one in, the rest wait; another category goes on', async () => {
		const event = await db.event();
		const small = await insertCategory(db.main, event.id, { capacity: 1 });
		const open = await insertCategory(db.main, event.id);
		const picks = [small.id, small.id, small.id, open.id];
		const people = await members(picks.length);
		const results = await Promise.all(
			picks.map((categoryId, i) => register(db.dbs[i + 1], people[i].id, event.id, categoryId))
		);
		const statusesIn = (categoryId: string) =>
			results
				.filter((_, i) => picks[i] === categoryId)
				.map((r) => (r.ok ? r.status : r.reason))
				.sort();
		expect(statusesIn(small.id)).toEqual(['registered', 'waitlist', 'waitlist']);
		expect(statusesIn(open.id)).toEqual(['registered']);
	});

	it('one member clicks twice at once: one registration, the second click is refused', async () => {
		const event = await db.event({ capacity: 5 });
		const [member] = await members(1);
		const [first, second] = await db.race(
			(tx) => register(tx, member.id, event.id),
			(tx) => register(tx, member.id, event.id)
		);
		expect(first).toMatchObject({ ok: true, status: 'registered' });
		expect(second).toEqual({ ok: false, reason: 'already_registered' });
		expect(await rowsOf(event.id)).toHaveLength(1);
	});

	it('a cancel and a new registration at once on a full event: the seat goes to the first in line', async () => {
		for (const cancelFirst of [true, false]) {
			const event = await db.event({ capacity: 1 });
			const [holder, queued, newcomer] = await members(3);
			await register(db.main, holder.id, event.id);
			expect(await register(db.main, queued.id, event.id)).toMatchObject({ status: 'waitlist' });
			const cancel = (tx: LimitDb) => cancelRegistration(tx, holder.id, event.id, cancelDeps());
			const join = (tx: LimitDb) => register(tx, newcomer.id, event.id);
			const [cancelled, joined] = cancelFirst
				? await db.race(cancel, join)
				: (await db.race(join, cancel)).reverse();
			expect(cancelled, `cancel first: ${cancelFirst}`).toBe('ok');
			expect(joined).toMatchObject({ ok: true, status: 'waitlist' });
			const rows = await rowsOf(event.id);
			const statusOf = (userId: string) => rows.find((r) => r.userId === userId)?.status;
			expect([holder, queued, newcomer].map((m) => statusOf(m.id))).toEqual([
				'cancelled',
				'registered',
				'waitlist'
			]);
		}
	});
});
