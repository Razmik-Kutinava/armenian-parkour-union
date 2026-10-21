import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { readListState } from '#lib/components/admin/list-state.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { pointsRules } from '../../db/schema/points';
import { users } from '../../db/schema/users';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { adjustPoints } from '../points/adjust';
import { appendEntry, type NewEntry } from '../points/ledger';
import { reverseEntry } from '../points/reverse';
import { setRules, staffActor } from '../points/test-support';
import { getOwnPoints, howToEarn, ownPointsOptions } from './points';

/* docs/06 section 5.6: own balance and ledger (date, reason, source, amount, comment), filter by
 * period and reason, "how to earn" from active rules; docs/04 section 5.3: only own entries. */

const IP = { ip: null };
const state = (query: Record<string, string> = {}) =>
	readListState(new URLSearchParams(query), ownPointsOptions);

async function add(tx: LimitDb, entry: NewEntry) {
	const result = await appendEntry(tx, entry);
	if (result.status !== 'ok') throw new Error(result.status);
	return result.entry;
}

const award = (userId: string, delta: number, createdAt?: Date): NewEntry => ({
	userId,
	delta,
	reason: 'event_participation',
	sourceType: 'event_registration',
	sourceId: crypto.randomUUID(),
	createdAt
});

describe.skipIf(!testDbUrl)('cabinet: own points', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('balance and only own entries, newest first; no staff author in the row', async () => {
		await inRollback(async (tx) => {
			const admin = await staffActor(tx);
			const member = await insertUser(tx);
			const other = await insertUser(tx);
			const old = await add(tx, award(member.id, 20, new Date('2026-01-01T10:00:00Z')));
			const manual = await adjustPoints(
				tx,
				admin,
				{ userId: member.id, delta: 15, comment: 'Volunteering' },
				IP
			);
			if (!manual.ok) throw new Error(manual.reason);
			await add(tx, award(other.id, 50));

			const own = await getOwnPoints(tx, member.id, state());
			expect(own?.balance).toBe(35);
			expect(own?.total).toBe(2);
			expect(own?.rows.map((r) => r.id)).toEqual([manual.entryId, old.id]);
			expect(own?.rows[0]).toMatchObject({
				delta: 15,
				reason: 'manual',
				sourceType: null,
				comment: 'Volunteering',
				reversed: false,
				reversalOf: null
			});
			expect(own?.rows[1]).toMatchObject({
				delta: 20,
				reason: 'event_participation',
				sourceType: 'event_registration',
				comment: null
			});
			expect(own?.rows[0]).not.toHaveProperty('createdBy');
			expect(own?.rows[0]).not.toHaveProperty('createdByName');
		});
	});

	it('a reversed entry is marked; the reversal shows the date of the original', async () => {
		await inRollback(async (tx) => {
			const admin = await staffActor(tx);
			const member = await insertUser(tx);
			const original = await add(tx, award(member.id, 20, new Date('2026-01-05T10:00:00Z')));
			const reversal = await reverseEntry(
				tx,
				admin,
				{ entryId: original.id, comment: 'Did not come' },
				IP
			);
			if (!reversal.ok) throw new Error(reversal.reason);
			const own = await getOwnPoints(tx, member.id, state());
			expect(own?.balance).toBe(0);
			expect(own?.rows.find((r) => r.id === original.id)?.reversed).toBe(true);
			expect(own?.rows.find((r) => r.id === reversal.entryId)).toMatchObject({
				reason: 'reversal',
				delta: -20,
				comment: 'Did not come',
				reversed: false,
				reversalOf: original.createdAt
			});
		});
	});

	it('filters: reason and period in Yerevan days; unknown keys and bad values are ignored', async () => {
		await inRollback(async (tx) => {
			const member = await insertUser(tx);
			const other = await insertUser(tx);
			const place = await add(tx, {
				...award(member.id, 50, new Date('2026-01-10T21:30:00Z')), // 11 January in Yerevan
				reason: 'event_place'
			});
			const small = await add(tx, award(member.id, 5, new Date('2026-01-10T12:00:00Z')));
			await add(tx, award(other.id, 7, new Date('2026-01-10T12:00:00Z')));
			const ids = async (query: Record<string, string>) =>
				((await getOwnPoints(tx, member.id, state(query)))?.rows ?? []).map((r) => r.id).sort();
			const all = [place.id, small.id].sort();
			expect(await ids({ reason: 'event_place' })).toEqual([place.id]);
			expect(await ids({ from: '2026-01-11', to: '2026-01-11' })).toEqual([place.id]);
			expect(await ids({ to: '2026-01-10' })).toEqual([small.id]);
			for (const bad of [
				{ reason: 'bogus' },
				{ from: '2026-02-30' },
				{ q: other.id },
				{ q: other.email },
				{ manual: '1' },
				{ over: '10' },
				{ suspicious: '1' }
			] as Record<string, string>[]) {
				expect(await ids(bad), JSON.stringify(bad)).toEqual(all);
			}
		});
	});

	it('25 per page; the total counts all own entries', async () => {
		await inRollback(async (tx) => {
			const member = await insertUser(tx);
			for (let i = 0; i < 27; i++) await add(tx, award(member.id, 1));
			const first = await getOwnPoints(tx, member.id, state());
			const second = await getOwnPoints(tx, member.id, state({ page: '2' }));
			expect(first?.total).toBe(27);
			expect(first?.rows).toHaveLength(25);
			expect(second?.rows).toHaveLength(2);
		});
	});

	it('deleted, unknown or malformed user: null', async () => {
		await inRollback(async (tx) => {
			const member = await insertUser(tx);
			await tx.update(users).set({ deletedAt: new Date() }).where(eq(users.id, member.id));
			expect(await getOwnPoints(tx, member.id, state())).toBeNull();
			expect(await getOwnPoints(tx, crypto.randomUUID(), state())).toBeNull();
			expect(await getOwnPoints(tx, 'nope', state())).toBeNull();
		});
	});
});

describe.skipIf(!testDbUrl)('cabinet: how to earn points', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('active rules with points, in the page language; most points first', async () => {
		await inRollback(async (tx) => {
			await setRules(tx, {
				event_registration: { points: 7 },
				event_place_1: { points: 900 },
				video_approved: { isActive: false },
				event_place_3: { points: 0 }
			});
			await tx
				.update(pointsRules)
				.set({ title: { en: 'Win an event', ru: 'Победа на событии' } })
				.where(eq(pointsRules.code, 'event_place_1'));
			await tx
				.insert(pointsRules)
				.values({ code: `unknown_${crypto.randomUUID()}`, title: { en: 'X' }, points: 999 });

			const ru = await howToEarn(tx, 'ru');
			const codes = ru.map((r) => r.code);
			expect(ru[0]).toEqual({ code: 'event_place_1', title: 'Победа на событии', points: 900 });
			expect(ru.find((r) => r.code === 'event_registration')?.points).toBe(7);
			expect(codes).not.toContain('video_approved');
			expect(codes).not.toContain('event_place_3');
			expect(codes.some((c) => c.startsWith('unknown_'))).toBe(false);
			const points = ru.map((r) => r.points);
			expect(points).toEqual([...points].sort((a, b) => b - a));
			const hy = await howToEarn(tx, 'hy');
			expect(hy.find((r) => r.code === 'event_place_1')?.title).toBe('Win an event');
		});
	});
});
