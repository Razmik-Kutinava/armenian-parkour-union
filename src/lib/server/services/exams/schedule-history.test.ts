import { afterAll, describe, expect, it } from 'vitest';
import { testDb, testDbUrl } from '../../db/test-db';
import { insertMember } from '../registrations/test-support';
import { scheduleExam, type ScheduleExamInput } from './schedule';
import type { ExamSettings } from './settings';
import {
	IP,
	NO_LIMITS,
	daysFrom,
	examsOf,
	insertCertificate,
	insertExam,
	insertStaff
} from './test-support';

/* docs/03 section 3.3, 4.2: what earlier exams and the current level allow — one scheduled exam of
 * a kind, a retake after the wait, a pass first gets its certificate, a minimum time on a level. */

type Tx = Parameters<typeof insertMember>[0];
const NOW = new Date();

const schedule = (
	tx: Tx,
	actor: Awaited<ReturnType<typeof insertStaff>>,
	userId: string,
	extra: Partial<ScheduleExamInput> = {},
	settings: ExamSettings = NO_LIMITS
) =>
	scheduleExam(
		tx,
		actor,
		{ userId, kind: 'level_advanced', scheduledAt: daysFrom(NOW, 7), ...extra },
		{ settings },
		IP,
		NOW
	);

describe.skipIf(!testDbUrl)('exams: schedule after earlier exams', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('one scheduled exam of a kind at a time; another kind is fine', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx, { level: 'novice' });
			const moderator = await insertStaff(tx);
			expect((await schedule(tx, moderator, member.id)).ok).toBe(true);
			expect(await schedule(tx, moderator, member.id)).toMatchObject({
				ok: false,
				reason: 'already_scheduled'
			});
			expect((await schedule(tx, moderator, member.id, { kind: 'trainer' })).ok).toBe(true);
			expect(await examsOf(tx, member.id)).toHaveLength(2);
		});
	});

	it('a retake is a new row, not earlier than `retake_days` after the failure', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx, { level: 'novice' });
			const moderator = await insertStaff(tx);
			await insertExam(tx, {
				userId: member.id,
				kind: 'level_advanced',
				result: 'failed',
				decidedAt: daysFrom(NOW, -10)
			});
			const settings = { retakeDays: 30, minDaysOnLevel: 0 };
			const at = (days: number) => ({ scheduledAt: daysFrom(NOW, days) });

			expect(await schedule(tx, moderator, member.id, at(7), settings)).toMatchObject({
				ok: false,
				reason: 'retake_too_soon'
			});
			expect((await schedule(tx, moderator, member.id, at(25), settings)).ok).toBe(true);
			expect((await examsOf(tx, member.id)).map((e) => e.result).sort()).toEqual([
				'failed',
				'scheduled'
			]);
		});
	});

	it('a pass waits for its certificate; with a certificate a new exam of the kind is allowed', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx, { level: 'novice' });
			const admin = await insertStaff(tx, 'admin');
			const passed = await insertExam(tx, {
				userId: member.id,
				kind: 'trainer',
				result: 'passed',
				decidedAt: daysFrom(NOW, -1)
			});
			const trainer = { kind: 'trainer' as const };

			expect(await schedule(tx, admin, member.id, trainer)).toMatchObject({
				ok: false,
				reason: 'awaiting_certificate'
			});
			await insertCertificate(tx, {
				userId: member.id,
				kind: 'trainer',
				examId: passed.id,
				issuedBy: admin.id
			});
			expect((await schedule(tx, admin, member.id, trainer)).ok).toBe(true);
			const rows = await examsOf(tx, member.id);
			expect(rows.filter((e) => e.result === 'scheduled')).toHaveLength(1);
		});
	});

	it('`min_days_on_level`: a novice from the first membership, higher — from the certificate', async () => {
		await inRollback(async (tx) => {
			const admin = await insertStaff(tx, 'admin');
			const minDays = (minDaysOnLevel: number) => ({ retakeDays: 0, minDaysOnLevel });
			// the membership started 30 days ago, the exam is in 7 days
			const member = await insertMember(tx, { level: 'novice' });
			expect(await schedule(tx, admin, member.id, {}, minDays(60))).toMatchObject({
				reason: 'level_too_recent'
			});
			expect((await schedule(tx, admin, member.id, {}, minDays(30))).ok).toBe(true);

			const advanced = await insertMember(tx, { level: 'advanced' });
			await insertCertificate(tx, {
				userId: advanced.id,
				kind: 'level',
				level: 'advanced',
				issuedBy: admin.id,
				issuedAt: daysFrom(NOW, -10)
			});
			const pro = { kind: 'level_pro' as const };
			expect(await schedule(tx, admin, advanced.id, pro, minDays(30))).toMatchObject({
				reason: 'level_too_recent'
			});
			expect((await schedule(tx, admin, advanced.id, pro, minDays(17))).ok).toBe(true);
		});
	});
});
