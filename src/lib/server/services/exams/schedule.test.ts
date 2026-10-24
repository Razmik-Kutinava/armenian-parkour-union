import { afterAll, describe, expect, it } from 'vitest';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { auditFor } from '../memberships/test-support';
import { insertEvent, insertMember } from '../registrations/test-support';
import { scheduleExam, type ScheduleExamInput } from './schedule';
import {
	IP,
	NO_LIMITS,
	daysFrom,
	examRow,
	examsOf,
	insertCertificate,
	insertExam,
	insertStaff,
	levelOf
} from './test-support';

/* docs/03 section 3.3, 4.1–4.2; docs/04 sections 2, 5.1; docs/05 section 7: a moderator or an
 * admin schedules an exam for a member with an active membership; a retake is a new row. */

type Tx = Parameters<typeof insertUser>[0];
const NOW = new Date();
const input = (userId: string, extra: Partial<ScheduleExamInput> = {}): ScheduleExamInput => ({
	userId,
	kind: 'level_advanced',
	scheduledAt: daysFrom(NOW, 7),
	...extra
});
const novice = (tx: Tx) => insertMember(tx, { level: 'novice' });

describe.skipIf(!testDbUrl)('exams: schedule', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a moderator schedules with an event and an examiner; logged; the level is unchanged', async () => {
		await inRollback(async (tx) => {
			const member = await novice(tx);
			const moderator = await insertStaff(tx);
			const examiner = await insertStaff(tx, 'admin');
			const event = await insertEvent(tx);
			const data = input(member.id, {
				eventId: event.id,
				examinerId: examiner.id,
				notes: '  Bring shoes  '
			});

			const result = await scheduleExam(tx, moderator, data, { settings: NO_LIMITS }, IP, NOW);
			if (!result.ok) throw new Error(result.reason);
			expect(result.warnings).toEqual([]);
			expect(await examRow(tx, result.id)).toMatchObject({
				userId: member.id,
				kind: 'level_advanced',
				eventId: event.id,
				examinerId: examiner.id,
				scheduledAt: data.scheduledAt,
				result: 'scheduled',
				score: null,
				notes: 'Bring shoes',
				decidedAt: null
			});
			const [entry] = await auditFor(tx, 'exam', result.id);
			expect(entry).toMatchObject({
				action: 'exam.schedule',
				actorId: moderator.id,
				after: { userId: member.id, kind: 'level_advanced', eventId: event.id, warnings: [] }
			});
			expect(await levelOf(tx, member.id)).toBe('novice');
		});
	});

	it('editor or member, no membership, blocked, deleted, bad event, examiner or input — refused', async () => {
		await inRollback(async (tx) => {
			const moderator = await insertStaff(tx);
			const run = (actor: typeof moderator, data: ScheduleExamInput) =>
				scheduleExam(tx, actor, data, { settings: NO_LIMITS }, IP, NOW);
			const member = await novice(tx);
			const reason = async (actor: typeof moderator, data: ScheduleExamInput) => {
				const r = await run(actor, data);
				return r.ok ? 'ok' : r.reason;
			};

			expect(await reason(await insertStaff(tx, 'editor'), input(member.id))).toBe('not_allowed');
			expect(await reason(await insertStaff(tx, 'member'), input(member.id))).toBe('not_allowed');
			const outsider = await insertUser(tx, { emailVerified: true, level: 'novice' });
			expect(await reason(moderator, input(outsider.id))).toBe('no_membership');
			const blocked = await insertMember(tx, { level: 'novice', status: 'blocked' });
			expect(await reason(moderator, input(blocked.id))).toBe('blocked');
			const gone = await insertMember(tx, { level: 'novice', deletedAt: new Date() });
			expect(await reason(moderator, input(gone.id))).toBe('user_not_found');
			expect(await reason(moderator, input(crypto.randomUUID()))).toBe('user_not_found');
			expect(await reason(moderator, input('nope'))).toBe('user_not_found');

			const deletedEvent = await insertEvent(tx, { deletedAt: new Date() });
			for (const eventId of [deletedEvent.id, crypto.randomUUID()]) {
				expect(await reason(moderator, input(member.id, { eventId }))).toBe('event_not_found');
			}
			const plain = await insertUser(tx);
			const blockedStaff = await insertUser(tx, { role: 'moderator', status: 'blocked' });
			const editor = await insertStaff(tx, 'editor');
			for (const examinerId of [plain.id, blockedStaff.id, editor.id, crypto.randomUUID()]) {
				expect(await reason(moderator, input(member.id, { examinerId }))).toBe('examiner_invalid');
			}
			for (const bad of [
				{ scheduledAt: new Date('nope') },
				{ notes: 'x'.repeat(2001) },
				{ kind: 'level_master' as ScheduleExamInput['kind'] }
			]) {
				expect(await reason(moderator, input(member.id, bad)), JSON.stringify(bad)).toBe('invalid');
			}
			expect(await examsOf(tx, member.id)).toEqual([]);
		});
	});

	it('a level that does not fit only warns: scheduled after confirmation, the warning logged', async () => {
		await inRollback(async (tx) => {
			const member = await novice(tx);
			const admin = await insertStaff(tx, 'admin');
			const run = (confirmLevel: boolean) =>
				scheduleExam(
					tx,
					admin,
					input(member.id, { kind: 'level_pro', confirmLevel }),
					{ settings: NO_LIMITS },
					IP,
					NOW
				);

			expect(await run(false)).toEqual({
				ok: false,
				reason: 'confirm_level',
				warnings: ['level_mismatch']
			});
			expect(await examsOf(tx, member.id)).toEqual([]);
			const result = await run(true);
			if (!result.ok) throw new Error(result.reason);
			expect(result.warnings).toEqual(['level_mismatch']);
			const [entry] = await auditFor(tx, 'exam', result.id);
			expect(entry.after).toMatchObject({ kind: 'level_pro', warnings: ['level_mismatch'] });
			expect(await levelOf(tx, member.id)).toBe('novice');
		});
	});

	it('one scheduled exam of a kind at a time; another kind is fine', async () => {
		await inRollback(async (tx) => {
			const member = await novice(tx);
			const moderator = await insertStaff(tx);
			const run = (kind: ScheduleExamInput['kind']) =>
				scheduleExam(tx, moderator, input(member.id, { kind }), { settings: NO_LIMITS }, IP, NOW);
			expect((await run('level_advanced')).ok).toBe(true);
			expect(await run('level_advanced')).toMatchObject({ ok: false, reason: 'already_scheduled' });
			expect((await run('trainer')).ok).toBe(true);
			expect(await examsOf(tx, member.id)).toHaveLength(2);
		});
	});

	it('a retake is a new row, not earlier than `retake_days` after the failure', async () => {
		await inRollback(async (tx) => {
			const member = await novice(tx);
			const moderator = await insertStaff(tx);
			await insertExam(tx, {
				userId: member.id,
				kind: 'level_advanced',
				result: 'failed',
				decidedAt: daysFrom(NOW, -10)
			});
			const settings = { retakeDays: 30, minDaysOnLevel: 0 };
			const run = (days: number) =>
				scheduleExam(
					tx,
					moderator,
					input(member.id, { scheduledAt: daysFrom(NOW, days) }),
					{ settings },
					IP,
					NOW
				);

			expect(await run(7)).toMatchObject({ ok: false, reason: 'retake_too_soon' });
			expect((await run(25)).ok).toBe(true);
			expect((await examsOf(tx, member.id)).map((e) => e.result).sort()).toEqual([
				'failed',
				'scheduled'
			]);
		});
	});

	it('a pass waits for its certificate; with a certificate a new exam of the kind is allowed', async () => {
		await inRollback(async (tx) => {
			const member = await novice(tx);
			const admin = await insertStaff(tx, 'admin');
			const passed = await insertExam(tx, {
				userId: member.id,
				kind: 'trainer',
				result: 'passed',
				decidedAt: daysFrom(NOW, -1)
			});
			const run = () =>
				scheduleExam(
					tx,
					admin,
					input(member.id, { kind: 'trainer' }),
					{ settings: NO_LIMITS },
					IP,
					NOW
				);

			expect(await run()).toMatchObject({ ok: false, reason: 'awaiting_certificate' });
			await insertCertificate(tx, {
				userId: member.id,
				kind: 'trainer',
				examId: passed.id,
				issuedBy: admin.id
			});
			expect((await run()).ok).toBe(true);
			const rows = await examsOf(tx, member.id);
			expect(rows.filter((e) => e.result === 'scheduled')).toHaveLength(1);
		});
	});

	it('`min_days_on_level`: a novice from the first membership, higher — from the certificate', async () => {
		await inRollback(async (tx) => {
			const admin = await insertStaff(tx, 'admin');
			const member = await novice(tx); // membership started 30 days ago
			const run = (userId: string, kind: ScheduleExamInput['kind'], minDaysOnLevel: number) =>
				scheduleExam(
					tx,
					admin,
					input(userId, { kind }),
					{ settings: { retakeDays: 0, minDaysOnLevel } },
					IP,
					NOW
				);
			expect(await run(member.id, 'level_advanced', 60)).toMatchObject({
				reason: 'level_too_recent'
			});
			expect((await run(member.id, 'level_advanced', 30)).ok).toBe(true);

			const advanced = await insertMember(tx, { level: 'advanced' });
			await insertCertificate(tx, {
				userId: advanced.id,
				kind: 'level',
				level: 'advanced',
				issuedBy: admin.id,
				issuedAt: daysFrom(NOW, -10)
			});
			expect(await run(advanced.id, 'level_pro', 30)).toMatchObject({
				reason: 'level_too_recent'
			});
			expect((await run(advanced.id, 'level_pro', 17)).ok).toBe(true);
		});
	});
});
