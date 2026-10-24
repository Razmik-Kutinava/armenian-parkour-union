import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { memberships } from '../../db/schema/payments';
import { pointsLedger } from '../../db/schema/points';
import { users } from '../../db/schema/users';
import { videos } from '../../db/schema/videos';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { DAY, insertEvent } from '../registrations/test-support';
import { VIDEO_DEFAULTS } from './settings';
import { addVideo } from './submit';

/* docs/03 section 8, docs/04 section 7, docs/06 section 5.7; the limit — decisions.md 2026-10-24. */

const NOW = new Date('2026-11-01T00:30:00+04:00');
const LINK = 'https://youtu.be/dQw4w9WgXcQ';
const WATCH = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const input = (url = LINK, eventId: string | null = null) => ({ url, title: 'Wall run', eventId });
const yt = (n: number) => `https://youtu.be/${String(n).padStart(11, 'a')}`;

async function insertMember(tx: LimitDb, now = NOW) {
	const user = await insertUser(tx, { emailVerified: true });
	await tx.insert(memberships).values({
		userId: user.id,
		status: 'active',
		startsAt: new Date(now.getTime() - 30 * DAY),
		endsAt: new Date(now.getTime() + 300 * DAY)
	});
	return user;
}

const videosOf = (tx: LimitDb, userId: string) =>
	tx.select().from(videos).where(eq(videos.userId, userId));

describe.skipIf(!testDbUrl)('videos: addVideo', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a member adds a link: pending, normalized, no points', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx);
			const result = await addVideo(tx, member.id, input(), VIDEO_DEFAULTS, NOW);
			expect(result).toMatchObject({ ok: true });
			const [row] = await videosOf(tx, member.id);
			expect(row).toMatchObject({
				url: WATCH,
				platform: 'youtube',
				title: 'Wall run',
				eventId: null,
				status: 'pending'
			});
			const points = await tx
				.select()
				.from(pointsLedger)
				.where(eq(pointsLedger.userId, member.id));
			expect(points).toEqual([]);
		});
	});

	it('no active membership: refused; blocked or deleted: not found', async () => {
		await inRollback(async (tx) => {
			const guest = await insertUser(tx, { emailVerified: true });
			expect(await addVideo(tx, guest.id, input(), VIDEO_DEFAULTS, NOW)).toEqual({
				ok: false,
				reason: 'no_membership'
			});
			const expired = await insertMember(tx, new Date(NOW.getTime() - 400 * DAY));
			expect(await addVideo(tx, expired.id, input(), VIDEO_DEFAULTS, NOW)).toMatchObject({
				reason: 'no_membership'
			});
			const blocked = await insertMember(tx);
			await tx.update(users).set({ status: 'blocked' }).where(eq(users.id, blocked.id));
			expect(await addVideo(tx, blocked.id, input(), VIDEO_DEFAULTS, NOW)).toMatchObject({
				reason: 'not_found'
			});
			const deleted = await insertMember(tx);
			await tx.update(users).set({ deletedAt: NOW }).where(eq(users.id, deleted.id));
			expect(await addVideo(tx, deleted.id, input(), VIDEO_DEFAULTS, NOW)).toMatchObject({
				reason: 'not_found'
			});
			expect(await addVideo(tx, 'nope', input(), VIDEO_DEFAULTS, NOW)).toMatchObject({
				reason: 'not_found'
			});
		});
	});

	it('another platform or a switched-off one: refused, nothing written', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx);
			const vimeo = await addVideo(tx, member.id, input('https://vimeo.com/1'), VIDEO_DEFAULTS, NOW);
			expect(vimeo).toEqual({ ok: false, reason: 'platform' });
			const off = { ...VIDEO_DEFAULTS, platforms: ['instagram' as const] };
			expect(await addVideo(tx, member.id, input(), off, NOW)).toMatchObject({
				reason: 'platform'
			});
			expect(await videosOf(tx, member.id)).toEqual([]);
		});
	});

	it('the same video under another link is a duplicate; another member may add it', async () => {
		await inRollback(async (tx) => {
			const [a, b] = [await insertMember(tx), await insertMember(tx)];
			await addVideo(tx, a.id, input(), VIDEO_DEFAULTS, NOW);
			expect(await addVideo(tx, a.id, input(`${WATCH}&t=5s`), VIDEO_DEFAULTS, NOW)).toEqual({
				ok: false,
				reason: 'duplicate'
			});
			expect(await addVideo(tx, b.id, input(), VIDEO_DEFAULTS, NOW)).toMatchObject({ ok: true });
		});
	});

	it('limit per calendar month in Yerevan: rejected ones count, last month does not', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx);
			const settings = { ...VIDEO_DEFAULTS, monthlyLimit: 2 };
			/* 23:00 on 31 October in Yerevan is the same UTC day as NOW, but the previous month. */
			await tx.insert(videos).values({
				userId: member.id,
				url: yt(1),
				platform: 'youtube',
				createdAt: new Date('2026-10-31T23:00:00+04:00')
			});
			await tx.insert(videos).values({
				userId: member.id,
				url: yt(2),
				platform: 'youtube',
				status: 'rejected',
				reviewedAt: NOW,
				rejectReason: 'Not parkour',
				createdAt: NOW
			});
			expect(await addVideo(tx, member.id, input(yt(3)), settings, NOW)).toMatchObject({
				ok: true
			});
			expect(await addVideo(tx, member.id, input(yt(4)), settings, NOW)).toEqual({
				ok: false,
				reason: 'limit'
			});
		});
	});

	it('event: a shown and started one only', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx);
			const past = { publishedAt: new Date(NOW.getTime() - 20 * DAY) };
			const started = await insertEvent(tx, { ...past, startsAt: new Date(NOW.getTime() - DAY) });
			const finished = await insertEvent(tx, {
				...past,
				status: 'finished',
				startsAt: new Date(NOW.getTime() - 10 * DAY)
			});
			const future = await insertEvent(tx, { ...past, startsAt: new Date(NOW.getTime() + DAY) });
			const draft = await insertEvent(tx, {
				...past,
				status: 'draft',
				startsAt: new Date(NOW.getTime() - DAY)
			});
			const removed = await insertEvent(tx, {
				...past,
				startsAt: new Date(NOW.getTime() - DAY),
				deletedAt: NOW
			});
			const add = (n: number, eventId: string) =>
				addVideo(tx, member.id, input(yt(n), eventId), VIDEO_DEFAULTS, NOW);
			expect(await add(1, started.id)).toMatchObject({ ok: true });
			expect(await add(2, finished.id)).toMatchObject({ ok: true });
			for (const [n, event] of [future, draft, removed].entries()) {
				expect(await add(10 + n, event.id)).toEqual({ ok: false, reason: 'event' });
			}
			expect(await add(20, 'nope')).toEqual({ ok: false, reason: 'event' });
			const rows = await videosOf(tx, member.id);
			expect(rows.map((r) => r.eventId).sort()).toEqual([started.id, finished.id].sort());
		});
	});
});
