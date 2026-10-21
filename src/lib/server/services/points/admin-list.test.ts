import { afterAll, describe, expect, it } from 'vitest';
import { readListState } from '#lib/components/admin/list-state.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { adjustPoints } from './adjust';
import { listPoints, pointsListOptions } from './admin-list';
import { appendEntry, type NewEntry } from './ledger';
import { reverseEntry } from './reverse';
import { staffActor } from './test-support';

/* docs/05 section 12: the points ledger in the admin — who, how much, why, from what, by whom;
 * filters by member, reason, period, manual operations, amount over N; a reversed entry is marked. */

const IP = { ip: null };
const state = (query: Record<string, string>) =>
	readListState(new URLSearchParams(query), pointsListOptions);

async function add(tx: LimitDb, entry: NewEntry) {
	const result = await appendEntry(tx, entry);
	if (result.status !== 'ok') throw new Error(result.status);
	return result.entry;
}

describe.skipIf(!testDbUrl)('admin points: ledger list', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('row: member, amount, reason, source, comment, who made it; system entries have no author', async () => {
		await inRollback(async (tx) => {
			const admin = await staffActor(tx);
			const member = await insertUser(tx);
			const sourceId = crypto.randomUUID();
			const system = await add(tx, {
				userId: member.id,
				delta: 20,
				reason: 'event_participation',
				sourceType: 'event_registration',
				sourceId
			});
			const manual = await adjustPoints(
				tx,
				admin,
				{ userId: member.id, delta: -5, comment: 'Fix' },
				IP
			);
			if (!manual.ok) throw new Error(manual.reason);
			const { rows, total } = await listPoints(tx, state({ q: member.tag }));
			expect(total).toBe(2);
			expect(rows.find((r) => r.id === system.id)).toMatchObject({
				userId: member.id,
				userEmail: member.email,
				userName: `Test ${member.tag}`,
				delta: 20,
				reason: 'event_participation',
				sourceType: 'event_registration',
				sourceId,
				comment: null,
				createdBy: null,
				createdByName: null,
				reversedById: null
			});
			expect(rows.find((r) => r.id === manual.entryId)).toMatchObject({
				delta: -5,
				reason: 'manual',
				comment: 'Fix',
				createdBy: admin.id,
				createdByName: expect.stringContaining('Test')
			});
		});
	});

	it('a reversed entry points to its reversal; the reversal points to the original', async () => {
		await inRollback(async (tx) => {
			const admin = await staffActor(tx);
			const member = await insertUser(tx);
			const original = await add(tx, {
				userId: member.id,
				delta: 10,
				reason: 'video',
				sourceType: 'video',
				sourceId: crypto.randomUUID()
			});
			const reversal = await reverseEntry(
				tx,
				admin,
				{ entryId: original.id, comment: 'Duplicate video' },
				IP
			);
			if (!reversal.ok) throw new Error(reversal.reason);
			const { rows } = await listPoints(tx, state({ q: member.tag }));
			expect(rows.find((r) => r.id === original.id)?.reversedById).toBe(reversal.entryId);
			expect(rows.find((r) => r.id === reversal.entryId)).toMatchObject({
				reason: 'reversal',
				delta: -10,
				reversalOfId: original.id,
				reversedById: null
			});
		});
	});

	it('search by member name, email or id; newest first by default', async () => {
		await inRollback(async (tx) => {
			const member = await insertUser(tx);
			const other = await insertUser(tx);
			const first = await add(tx, {
				userId: member.id,
				delta: 5,
				reason: 'event_registration',
				sourceType: 'event_registration',
				sourceId: crypto.randomUUID(),
				createdAt: new Date('2026-01-01T10:00:00Z')
			});
			const second = await add(tx, {
				userId: member.id,
				delta: 20,
				reason: 'event_participation',
				sourceType: 'event_registration',
				sourceId: crypto.randomUUID(),
				createdAt: new Date('2026-01-02T10:00:00Z')
			});
			await add(tx, {
				userId: other.id,
				delta: 5,
				reason: 'event_registration',
				sourceType: 'event_registration',
				sourceId: crypto.randomUUID()
			});
			const ids = async (q: string) => (await listPoints(tx, state({ q }))).rows.map((r) => r.id);
			expect(await ids(member.tag)).toEqual([second.id, first.id]);
			expect(await ids(member.email.toUpperCase())).toEqual([second.id, first.id]);
			expect(await ids(member.id)).toEqual([second.id, first.id]);
		});
	});

	it('filters: reason, period in Yerevan days, manual only, amount over N; bad values are ignored', async () => {
		await inRollback(async (tx) => {
			const admin = await staffActor(tx);
			const member = await insertUser(tx);
			const place = await add(tx, {
				userId: member.id,
				delta: 50,
				reason: 'event_place',
				sourceType: 'event_registration',
				sourceId: crypto.randomUUID(),
				createdAt: new Date('2026-01-10T21:30:00Z') // 11 January in Yerevan
			});
			const small = await add(tx, {
				userId: member.id,
				delta: 5,
				reason: 'event_registration',
				sourceType: 'event_registration',
				sourceId: crypto.randomUUID(),
				createdAt: new Date('2026-01-10T12:00:00Z')
			});
			const manual = await adjustPoints(
				tx,
				admin,
				{ userId: member.id, delta: -30, comment: 'Taken' },
				IP
			);
			if (!manual.ok) throw new Error(manual.reason);
			const ids = async (query: Record<string, string>) =>
				(await listPoints(tx, state({ q: member.tag, ...query }))).rows.map((r) => r.id).sort();
			const all = [place.id, small.id, manual.entryId].sort();
			expect(await ids({})).toEqual(all);
			expect(await ids({ reason: 'event_place' })).toEqual([place.id]);
			expect(await ids({ from: '2026-01-11', to: '2026-01-11' })).toEqual([place.id]);
			expect(await ids({ to: '2026-01-10' })).toEqual([small.id]);
			expect(await ids({ manual: '1' })).toEqual([manual.entryId]);
			expect(await ids({ over: '29' })).toEqual([place.id, manual.entryId].sort());
			expect(await ids({ over: '30' })).toEqual([place.id]);
			for (const bad of [
				{ reason: 'bogus' },
				{ from: '2026-02-30' },
				{ manual: 'yes' },
				{ over: '-1' },
				{ over: '1.5' },
				{ over: 'abc' },
				{ over: '9999999999' }
			]) {
				expect(await ids(bad), JSON.stringify(bad)).toEqual(all);
			}
		});
	});

	it('sort by amount', async () => {
		await inRollback(async (tx) => {
			const member = await insertUser(tx);
			for (const delta of [20, 5, 50]) {
				await add(tx, {
					userId: member.id,
					delta,
					reason: 'event_participation',
					sourceType: 'event_registration',
					sourceId: crypto.randomUUID()
				});
			}
			const { rows } = await listPoints(tx, state({ q: member.tag, sort: 'delta', dir: 'asc' }));
			expect(rows.map((r) => r.delta)).toEqual([5, 20, 50]);
		});
	});
});
