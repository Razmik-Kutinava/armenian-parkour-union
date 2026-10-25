import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { translate } from '#lib/i18n/translate.ts';
import type { LimitDb } from '../../auth/rate-limit';
import type { UserRole } from '../../auth/session';
import { auditLog } from '../../db/schema/service';
import { videos } from '../../db/schema/videos';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import type { Mail } from '../../mail/resend';
import { balanceOf, ledgerOf, setRules } from '../points/test-support';
import { moderateVideos } from './review';

/* docs/05 section 11, docs/03 sections 8 and 14: approve (points once), reject with a reason, hide an
 * approved one; a letter on a decision; decisions — docs/todo.md 7.2. */

const SITE = 'https://parkour.test';
const NOW = new Date('2026-11-05T12:00:00+04:00');

function deps() {
	const sent: Mail[] = [];
	return {
		sent,
		send: async (mail: Mail) => void sent.push(mail),
		siteUrl: SITE,
		ip: '10.0.0.9',
		now: NOW
	};
}

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
			url: `https://www.youtube.com/watch?v=${String(n).padStart(11, 'r')}`,
			platform: 'youtube',
			title: 'Wall run',
			...values
		})
		.returning();
	return row;
}

async function staff(tx: LimitDb, role: UserRole = 'moderator') {
	const { id } = await insertUser(tx, { role });
	return { id, role };
}

const stored = async (tx: LimitDb, id: string) =>
	(await tx.select().from(videos).where(eq(videos.id, id)))[0];

const auditOf = (tx: LimitDb, actorId: string) =>
	tx
		.select()
		.from(auditLog)
		.where(and(eq(auditLog.actorId, actorId)));

const approve = { action: 'approve' } as const;
const hide = { action: 'hide' } as const;
const reject = (reason: string) => ({ action: 'reject', reason }) as const;

describe.skipIf(!testDbUrl)('videos: moderation', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a moderator approves: points once, reviewer, audit on the member, a letter in their language', async () => {
		await inRollback(async (tx) => {
			await setRules(tx, { video_approved: { points: 10 } });
			const member = await insertUser(tx, { locale: 'hy' });
			const moderator = await staff(tx);
			const video = await insertVideo(tx, member.id);
			const d = deps();
			expect(await moderateVideos(tx, moderator, [video.id], approve, d)).toEqual({
				ok: true,
				done: 1,
				skipped: 0
			});
			expect(await stored(tx, video.id)).toMatchObject({
				status: 'approved',
				reviewedBy: moderator.id,
				reviewedAt: NOW,
				rejectReason: null,
				hiddenAt: null
			});
			const ledger = await ledgerOf(tx, member.id);
			expect(ledger).toHaveLength(1);
			expect(ledger[0]).toMatchObject({
				delta: 10,
				reason: 'video',
				sourceType: 'video',
				sourceId: video.id,
				createdBy: null
			});
			expect(await balanceOf(tx, member.id)).toBe(10);
			const [entry] = await auditOf(tx, moderator.id);
			expect(entry).toMatchObject({
				action: 'video.approve',
				entityType: 'user',
				entityId: member.id,
				ip: '10.0.0.9'
			});
			expect(entry.after).toMatchObject({ videoId: video.id, status: 'approved', points: 10 });
			expect(d.sent).toHaveLength(1);
			expect(d.sent[0].to).toBe(member.email);
			expect(d.sent[0].subject).toBe(translate('hy', 'videos.mail.approved.subject'));
			expect(d.sent[0].text).toContain('10');
			expect(d.sent[0].text).toContain(`${SITE}/hy/cabinet/videos`);
		});
	});

	it('a repeat approval is skipped: no second award, entry or letter', async () => {
		await inRollback(async (tx) => {
			await setRules(tx, { video_approved: { points: 10 } });
			const member = await insertUser(tx);
			const moderator = await staff(tx);
			const video = await insertVideo(tx, member.id);
			await moderateVideos(tx, moderator, [video.id], approve, deps());
			const d = deps();
			const admin = await staff(tx, 'admin');
			expect(await moderateVideos(tx, admin, [video.id], approve, d)).toEqual({
				ok: true,
				done: 0,
				skipped: 1
			});
			expect(await ledgerOf(tx, member.id)).toHaveLength(1);
			expect(await balanceOf(tx, member.id)).toBe(10);
			expect(await auditOf(tx, admin.id)).toHaveLength(0);
			expect(d.sent).toHaveLength(0);
		});
	});

	it('a switched-off rule: approved without points, the letter says nothing of points', async () => {
		await inRollback(async (tx) => {
			await setRules(tx, { video_approved: { points: 10, isActive: false } });
			const member = await insertUser(tx);
			const moderator = await staff(tx);
			const video = await insertVideo(tx, member.id);
			const d = deps();
			expect(await moderateVideos(tx, moderator, [video.id], approve, d)).toMatchObject({
				done: 1
			});
			expect((await stored(tx, video.id)).status).toBe('approved');
			expect(await ledgerOf(tx, member.id)).toHaveLength(0);
			expect((await auditOf(tx, moderator.id))[0].after).toMatchObject({ points: 0 });
			expect(d.sent[0].subject).toBe(translate('en', 'videos.mail.approved.subject'));
			expect(d.sent[0].text).not.toContain('point');
		});
	});

	it('a refusal keeps the reason, gives no points and sends the reason', async () => {
		await inRollback(async (tx) => {
			await setRules(tx, { video_approved: { points: 10 } });
			const member = await insertUser(tx);
			const moderator = await staff(tx);
			const video = await insertVideo(tx, member.id);
			const d = deps();
			const reason = 'Not parkour';
			expect(await moderateVideos(tx, moderator, [video.id], reject(` ${reason} `), d)).toEqual({
				ok: true,
				done: 1,
				skipped: 0
			});
			expect(await stored(tx, video.id)).toMatchObject({
				status: 'rejected',
				rejectReason: reason,
				reviewedBy: moderator.id,
				reviewedAt: NOW
			});
			expect(await ledgerOf(tx, member.id)).toHaveLength(0);
			const [entry] = await auditOf(tx, moderator.id);
			expect(entry).toMatchObject({ action: 'video.reject', entityId: member.id });
			expect(entry.after).toMatchObject({ videoId: video.id, rejectReason: reason });
			expect(d.sent[0].subject).toBe(translate('en', 'videos.mail.rejected.subject'));
			expect(d.sent[0].text).toContain(reason);
		});
	});

	it('a refusal without a reason is invalid; nothing changes', async () => {
		await inRollback(async (tx) => {
			const member = await insertUser(tx);
			const moderator = await staff(tx);
			const video = await insertVideo(tx, member.id);
			expect(await moderateVideos(tx, moderator, [video.id], reject('  '), deps())).toEqual({
				ok: false,
				reason: 'invalid'
			});
			expect((await stored(tx, video.id)).status).toBe('pending');
		});
	});

	it('only a pending video is approved or rejected; an approved one stays as it was', async () => {
		await inRollback(async (tx) => {
			await setRules(tx, { video_approved: { points: 10 } });
			const member = await insertUser(tx);
			const moderator = await staff(tx);
			const approved = await insertVideo(tx, member.id, {
				status: 'approved',
				reviewedAt: NOW
			});
			const rejected = await insertVideo(tx, member.id, {
				status: 'rejected',
				reviewedAt: NOW,
				rejectReason: 'Blurry'
			});
			const d = deps();
			const ids = [approved.id, rejected.id];
			expect(await moderateVideos(tx, moderator, ids, approve, d)).toMatchObject({ skipped: 2 });
			expect(await moderateVideos(tx, moderator, ids, reject('No'), d)).toMatchObject({
				skipped: 2
			});
			expect((await stored(tx, approved.id)).status).toBe('approved');
			expect(await stored(tx, rejected.id)).toMatchObject({
				status: 'rejected',
				rejectReason: 'Blurry'
			});
			expect(await ledgerOf(tx, member.id)).toHaveLength(0);
			expect(await auditOf(tx, moderator.id)).toHaveLength(0);
			expect(d.sent).toHaveLength(0);
		});
	});

	it('hide: only an approved one; status and points stay, no letter; twice is a skip', async () => {
		await inRollback(async (tx) => {
			await setRules(tx, { video_approved: { points: 10 } });
			const member = await insertUser(tx);
			const moderator = await staff(tx);
			const video = await insertVideo(tx, member.id);
			const pending = await insertVideo(tx, member.id);
			await moderateVideos(tx, moderator, [video.id], approve, deps());
			const d = deps();
			expect(await moderateVideos(tx, moderator, [video.id, pending.id], hide, d)).toEqual({
				ok: true,
				done: 1,
				skipped: 1
			});
			expect(await stored(tx, video.id)).toMatchObject({ status: 'approved', hiddenAt: NOW });
			expect((await stored(tx, pending.id)).hiddenAt).toBeNull();
			expect(await balanceOf(tx, member.id)).toBe(10);
			expect(await ledgerOf(tx, member.id)).toHaveLength(1);
			expect(d.sent).toHaveLength(0);
			const actions = (await auditOf(tx, moderator.id)).map((e) => e.action).sort();
			expect(actions).toEqual(['video.approve', 'video.hide']);
			expect(await moderateVideos(tx, moderator, [video.id], hide, d)).toMatchObject({
				skipped: 1
			});
		});
	});

	it('own video: a staff member neither approves nor rejects it', async () => {
		await inRollback(async (tx) => {
			await setRules(tx, { video_approved: { points: 10 } });
			const moderator = await staff(tx);
			const own = await insertVideo(tx, moderator.id);
			const d = deps();
			expect(await moderateVideos(tx, moderator, [own.id], approve, d)).toMatchObject({
				done: 0,
				skipped: 1
			});
			expect(await moderateVideos(tx, moderator, [own.id], reject('Mine'), d)).toMatchObject({
				skipped: 1
			});
			expect((await stored(tx, own.id)).status).toBe('pending');
			expect(await ledgerOf(tx, moderator.id)).toHaveLength(0);
			expect(d.sent).toHaveLength(0);
		});
	});

	it('an editor or a member may not moderate; nothing changes', async () => {
		await inRollback(async (tx) => {
			const member = await insertUser(tx);
			const video = await insertVideo(tx, member.id);
			for (const role of ['editor', 'member'] as const) {
				const actor = await staff(tx, role);
				for (const input of [approve, reject('No'), hide]) {
					expect(await moderateVideos(tx, actor, [video.id], input, deps())).toEqual({
						ok: false,
						reason: 'not_allowed'
					});
				}
			}
			expect((await stored(tx, video.id)).status).toBe('pending');
		});
	});

	it('a batch: each video on its own; unknown, malformed, repeated and deleted members are skipped', async () => {
		await inRollback(async (tx) => {
			await setRules(tx, { video_approved: { points: 10 } });
			const [a, b] = [await insertUser(tx), await insertUser(tx)];
			const gone = await insertUser(tx, { deletedAt: NOW });
			const moderator = await staff(tx);
			const va = await insertVideo(tx, a.id);
			const vb1 = await insertVideo(tx, b.id);
			const vb2 = await insertVideo(tx, b.id);
			const orphan = await insertVideo(tx, gone.id);
			const d = deps();
			const ids = [va.id, vb1.id, vb2.id, va.id, orphan.id, crypto.randomUUID(), 'nope'];
			expect(await moderateVideos(tx, moderator, ids, approve, d)).toEqual({
				ok: true,
				done: 3,
				skipped: 3
			});
			expect(await balanceOf(tx, a.id)).toBe(10);
			expect(await balanceOf(tx, b.id)).toBe(20);
			expect((await stored(tx, orphan.id)).status).toBe('pending');
			expect(d.sent.map((m) => m.to).sort()).toEqual([a.email, b.email, b.email].sort());
			const rows = await tx
				.select()
				.from(videos)
				.where(inArray(videos.id, [va.id, vb1.id, vb2.id]));
			expect(rows.every((r) => r.status === 'approved')).toBe(true);
		});
	});

	it('a failed letter does not undo the decision', async () => {
		await inRollback(async (tx) => {
			const member = await insertUser(tx);
			const moderator = await staff(tx);
			const video = await insertVideo(tx, member.id);
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const failing = {
				...deps(),
				send: async () => {
					throw new Error('mail is down');
				}
			};
			expect(await moderateVideos(tx, moderator, [video.id], reject('No'), failing)).toMatchObject({
				done: 1
			});
			expect(warn).toHaveBeenCalled();
			warn.mockRestore();
			expect((await stored(tx, video.id)).status).toBe('rejected');
		});
	});
});
