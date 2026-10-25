import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { videos } from '../../db/schema/videos';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { appendEntry } from '../points/ledger';
import { deleteOwnVideo, ownVideos } from './own';

/* docs/06 section 5.7: status, reject reason, points mark; delete until approved (hard —
 * decisions.md 2026-10-24). Decisions — docs/todo.md 7.7 (1, 2). */

type Status = 'pending' | 'approved' | 'rejected';

async function addVideo(tx: LimitDb, userId: string, status: Status, title: string) {
	const [row] = await tx
		.insert(videos)
		.values({
			userId,
			url: `https://www.youtube.com/watch?v=${crypto.randomUUID().slice(0, 11)}`,
			platform: 'youtube',
			title,
			status,
			reviewedAt: status === 'pending' ? null : new Date(),
			rejectReason: status === 'rejected' ? 'Too blurry' : null
		})
		.returning();
	return row;
}

const award = (tx: LimitDb, userId: string, videoId: string, delta: number) =>
	appendEntry(tx, { userId, delta, reason: 'video', sourceType: 'video', sourceId: videoId });

const rowOf = async (tx: LimitDb, id: string) =>
	(await tx.select().from(videos).where(eq(videos.id, id)))[0];

describe.skipIf(!testDbUrl)('videos: the member history', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('own videos only, with the reject reason and the points earned', async () => {
		await inRollback(async (tx) => {
			const { id: member } = await insertUser(tx);
			const { id: other } = await insertUser(tx);
			const pending = await addVideo(tx, member, 'pending', 'Pending');
			const rejected = await addVideo(tx, member, 'rejected', 'Rejected');
			const approved = await addVideo(tx, member, 'approved', 'Approved');
			await award(tx, member, approved.id, 15);
			await addVideo(tx, other, 'approved', 'Not mine');

			const list = await ownVideos(tx, member);
			expect(list).toHaveLength(3);
			const byId = new Map(list.map((v) => [v.id, v]));
			expect(byId.get(pending.id)).toMatchObject({
				status: 'pending',
				rejectReason: null,
				points: null
			});
			expect(byId.get(rejected.id)).toMatchObject({
				status: 'rejected',
				rejectReason: 'Too blurry',
				points: null
			});
			expect(byId.get(approved.id)).toMatchObject({
				status: 'approved',
				rejectReason: null,
				points: 15
			});
		});
	});

	it('a reversed award counts as zero; a hidden video shows as approved', async () => {
		await inRollback(async (tx) => {
			const { id: member } = await insertUser(tx);
			const video = await addVideo(tx, member, 'approved', 'Hidden later');
			const given = await award(tx, member, video.id, 20);
			if (given.status !== 'ok') throw new Error(given.status);
			await appendEntry(tx, {
				userId: member,
				delta: -20,
				reason: 'reversal',
				sourceType: 'video',
				sourceId: video.id,
				reversalOfId: given.entry.id,
				comment: 'Approved by mistake'
			});
			await tx.update(videos).set({ hiddenAt: new Date() }).where(eq(videos.id, video.id));
			const [row] = await ownVideos(tx, member);
			expect(row).toMatchObject({ status: 'approved', points: 0 });
		});
	});

	it('deletes own pending and rejected videos for good', async () => {
		await inRollback(async (tx) => {
			const { id: member } = await insertUser(tx);
			for (const status of ['pending', 'rejected'] as const) {
				const video = await addVideo(tx, member, status, status);
				expect(await deleteOwnVideo(tx, member, video.id)).toBe('ok');
				expect(await rowOf(tx, video.id)).toBeUndefined();
			}
			expect(await ownVideos(tx, member)).toEqual([]);
		});
	});

	it('an approved video stays; another member or a bad id is not found', async () => {
		await inRollback(async (tx) => {
			const { id: member } = await insertUser(tx);
			const { id: other } = await insertUser(tx);
			const approved = await addVideo(tx, member, 'approved', 'Approved');
			expect(await deleteOwnVideo(tx, member, approved.id)).toBe('not_allowed');
			expect(await rowOf(tx, approved.id)).toBeDefined();

			const foreign = await addVideo(tx, other, 'pending', 'Foreign');
			expect(await deleteOwnVideo(tx, member, foreign.id)).toBe('not_found');
			expect(await rowOf(tx, foreign.id)).toBeDefined();
			for (const id of [crypto.randomUUID(), 'nope']) {
				expect(await deleteOwnVideo(tx, member, id)).toBe('not_found');
			}
		});
	});
});
