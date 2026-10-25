import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { pointsRules } from '../../db/schema/points';
import { videos } from '../../db/schema/videos';
import { testDbUrl } from '../../db/test-db';
import type { Mail } from '../../mail/resend';
import { auditFor } from '../memberships/test-support';
import { balanceOf, ledgerOf, ledgerSum } from '../points/test-support';
import { raceDb } from '../registrations/race-support';
import type { Actor } from '../users/target';
import { deleteOwnVideo } from './own';
import { moderateVideos, type ModerationInput } from './review';

/* docs/03 sections 6.2 p. 2 and 8, roadmap 7.8: two moderators decide one video at the same moment,
 * or the member deletes it while it is being approved. Both sides lock the video row, so the second
 * sees the first: points once, one decision. These tests commit (registrations/race-support.ts):
 * the rule is only added where missing, the expected award follows the rule as it is; the videos
 * are deleted afterwards, or the moderation queue of the test database would show them. */

const RULE = 'video_approved';
const approve = { action: 'approve' } as const;
const reject = { action: 'reject', reason: 'Not parkour' } as const;

describe.skipIf(!testDbUrl)('videos: simultaneous moderation and delete', () => {
	const db = raceDb();
	const members: string[] = [];
	afterAll(async () => {
		if (members.length) await db.main.delete(videos).where(inArray(videos.userId, members));
		await db.cleanup();
	});
	let award = 0;
	beforeAll(async () => {
		await db.main
			.insert(pointsRules)
			.values({ code: RULE, title: { en: RULE }, points: 10 })
			.onConflictDoNothing({ target: pointsRules.code });
		const [rule] = await db.main.select().from(pointsRules).where(eq(pointsRules.code, RULE));
		award = rule.isActive && rule.points > 0 ? rule.points : 0;
	});

	async function pendingVideo() {
		const { id: userId } = await db.member();
		members.push(userId);
		const [video] = await db.main
			.insert(videos)
			.values({
				userId,
				url: `https://www.youtube.com/watch?v=${crypto.randomUUID().slice(0, 11)}`,
				platform: 'youtube',
				title: 'Wall run'
			})
			.returning();
		return video;
	}

	const sent: Mail[] = [];
	const decide = (actor: Actor, id: string, input: ModerationInput) => (tx: LimitDb) =>
		moderateVideos(tx, actor, [id], input, {
			send: async (m) => void sent.push(m),
			siteUrl: undefined,
			ip: null
		});
	const statusOf = async (id: string) =>
		(await db.main.select().from(videos).where(eq(videos.id, id)))[0]?.status;
	const decisions = async (userId: string) =>
		(await auditFor(db.main, 'user', userId)).map((e) => e.action).sort();

	async function pointsOnce(userId: string, times: 0 | 1) {
		expect(await ledgerOf(db.main, userId)).toHaveLength(award ? times : 0);
		expect(await balanceOf(db.main, userId)).toBe(award * times);
		expect(await ledgerSum(db.main, userId)).toBe(award * times);
	}

	it('two moderators approve one video at once: approved once, points once, one letter', async () => {
		const video = await pendingVideo();
		const [a, b] = [await db.staff(), await db.staff()];
		sent.length = 0;
		const results = await db.race(decide(a, video.id, approve), decide(b, video.id, approve));
		expect(results).toEqual([
			{ ok: true, done: 1, skipped: 0 },
			{ ok: true, done: 0, skipped: 1 }
		]);
		expect(await statusOf(video.id)).toBe('approved');
		await pointsOnce(video.userId, 1);
		expect(await decisions(video.userId)).toEqual(['video.approve']);
		expect(sent).toHaveLength(1);
	});

	for (const approveFirst of [true, false]) {
		const first = approveFirst ? 'approve' : 'reject';
		it(`approve and reject at once, ${first} first: the first decision stays`, async () => {
			const video = await pendingVideo();
			const [a, b] = [await db.staff(), await db.staff()];
			const steps = approveFirst ? [approve, reject] : [reject, approve];
			const results = await db.race(decide(a, video.id, steps[0]), decide(b, video.id, steps[1]));
			expect(results.map((r) => r.ok && r.done)).toEqual([1, 0]);
			expect(await statusOf(video.id)).toBe(approveFirst ? 'approved' : 'rejected');
			await pointsOnce(video.userId, approveFirst ? 1 : 0);
			expect(await decisions(video.userId)).toEqual([`video.${first}`]);
		});

		it(`the member deletes while a moderator approves, ${first === 'approve' ? 'approve' : 'delete'} first`, async () => {
			const video = await pendingVideo();
			const moderator = await db.staff();
			const remove = (tx: LimitDb) => deleteOwnVideo(tx, video.userId, video.id);
			const approval = decide(moderator, video.id, approve);
			if (approveFirst) {
				const [approved, deleted] = await db.race(approval, remove);
				expect(approved).toEqual({ ok: true, done: 1, skipped: 0 });
				expect(deleted).toBe('not_allowed');
				expect(await statusOf(video.id)).toBe('approved');
			} else {
				const [deleted, approved] = await db.race(remove, approval);
				expect(deleted).toBe('ok');
				expect(approved).toEqual({ ok: true, done: 0, skipped: 1 });
				expect(await statusOf(video.id)).toBeUndefined();
			}
			await pointsOnce(video.userId, approveFirst ? 1 : 0);
		});
	}
});
