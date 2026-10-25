import { afterAll, describe, expect, it } from 'vitest';
import { readListState, type ListState } from '#lib/components/admin/list-state.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { videos } from '../../db/schema/videos';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { insertEvent } from '../registrations/test-support';
import { listVideos, videoListOptions } from './admin-list';

/* docs/05 section 11: the queue — "under review" first by default, oldest on top; filters status and
 * platform; the search by member name (docs/todo.md 7.2, decision 7). */

const state = (q: string, filters: Record<string, string> = {}): ListState => ({
	...readListState(new URLSearchParams(), videoListOptions),
	q,
	filters
});

let n = 0;
async function insertVideo(
	tx: LimitDb,
	userId: string,
	values: Partial<typeof videos.$inferInsert> = {}
) {
	n += 1;
	const [row] = await tx
		.insert(videos)
		.values({
			userId,
			url: `https://www.youtube.com/watch?v=${String(n).padStart(11, 'q')}`,
			platform: 'youtube',
			title: `Run ${n}`,
			...values
		})
		.returning();
	return row;
}

const day = (d: number) => new Date(Date.UTC(2026, 10, d, 9));

describe.skipIf(!testDbUrl)('videos: admin list', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('by default: pending only, oldest on top', () => {
		const s = readListState(new URLSearchParams(), videoListOptions);
		expect(s).toMatchObject({ sort: 'createdAt', dir: 'asc' });
	});

	it('status filter: pending by default, approved without hidden, hidden, rejected, all', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx);
			const reviewed = { reviewedAt: day(9) };
			const late = await insertVideo(tx, user.id, { createdAt: day(3) });
			const early = await insertVideo(tx, user.id, { createdAt: day(1) });
			const approved = await insertVideo(tx, user.id, { status: 'approved', ...reviewed });
			const hidden = await insertVideo(tx, user.id, {
				status: 'approved',
				...reviewed,
				hiddenAt: day(9)
			});
			const rejected = await insertVideo(tx, user.id, {
				status: 'rejected',
				...reviewed,
				rejectReason: 'Blurry'
			});
			const ids = async (filters: Record<string, string>) =>
				(await listVideos(tx, state(user.tag, filters))).rows.map((r) => r.id);

			expect(await ids({})).toEqual([early.id, late.id]);
			expect(await ids({ status: 'bogus' })).toEqual([early.id, late.id]);
			expect(await ids({ status: 'approved' })).toEqual([approved.id]);
			expect(await ids({ status: 'hidden' })).toEqual([hidden.id]);
			expect(await ids({ status: 'rejected' })).toEqual([rejected.id]);
			expect((await listVideos(tx, state(user.tag, { status: 'all' }))).total).toBe(5);
			const hiddenRow = (await listVideos(tx, state(user.tag, { status: 'hidden' }))).rows[0];
			expect(hiddenRow.status).toBe('hidden');
			const rejectedRow = (await listVideos(tx, state(user.tag, { status: 'rejected' }))).rows[0];
			expect(rejectedRow).toMatchObject({ status: 'rejected', rejectReason: 'Blurry' });
		});
	});

	it('platform filter; an unknown platform is ignored', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx);
			const yt = await insertVideo(tx, user.id);
			const ig = await insertVideo(tx, user.id, {
				url: `https://www.instagram.com/reel/${crypto.randomUUID().slice(0, 8)}/`,
				platform: 'instagram'
			});
			const ids = async (filters: Record<string, string>) =>
				(await listVideos(tx, state(user.tag, filters))).rows.map((r) => r.id).sort();
			expect(await ids({ platform: 'instagram' })).toEqual([ig.id]);
			expect(await ids({ platform: 'vimeo' })).toEqual([yt.id, ig.id].sort());
		});
	});

	it('a row: member name, link, platform, title, event title; no contacts; deleted members hidden', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx);
			const event = await insertEvent(tx, { title: { en: 'Yerevan Jam' } });
			const video = await insertVideo(tx, user.id, { eventId: event.id });
			const [row] = (await listVideos(tx, state(user.tag))).rows;
			expect(row).toMatchObject({
				id: video.id,
				userId: user.id,
				memberName: `Test ${user.tag}`,
				url: video.url,
				platform: 'youtube',
				title: video.title,
				eventTitle: { en: 'Yerevan Jam' },
				status: 'pending'
			});
			expect(row).not.toHaveProperty('email');
			expect((await listVideos(tx, state(`${user.tag}-nobody`))).total).toBe(0);
			const gone = await insertUser(tx, { deletedAt: new Date() });
			await insertVideo(tx, gone.id);
			expect((await listVideos(tx, state(gone.tag))).total).toBe(0);
		});
	});
});
