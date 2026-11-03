import { afterAll, describe, expect, it } from 'vitest';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { auditFor } from '../memberships/test-support';
import { insertMember } from '../registrations/test-support';
import { setFederationEmail } from '../training/test-support';
import { rejectExamApplication } from './application-decide';
import { applyForExam } from './apply';
import { scheduleExam } from './schedule';
import {
	applicationDeps,
	applicationRow,
	applicationsOf,
	insertExam,
	insertStaff,
	IP,
	mailbox,
	NO_LIMITS,
	SITE
} from './test-support';

/* docs/04 § 7; decisions — docs/todo.md (долг этапа 6, заявка из кабинета). */

const OFFICE = 'office@parkour.test';
const NOW = new Date();
const week = new Date(NOW.getTime() + 7 * 86_400_000);

describe.skipIf(!testDbUrl)('exams: apply from the cabinet', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a novice who meets the conditions applies: pending level_advanced, letter, no audit', async () => {
		await inRollback(async (tx) => {
			await setFederationEmail(tx, OFFICE);
			const user = await insertMember(tx, { level: 'novice', firstName: 'Aram' });
			const mail = mailbox();
			const result = await applyForExam(tx, user.id, applicationDeps(mail.send), NOW);
			if (!result.ok) throw new Error(result.reason);
			expect(await applicationRow(tx, result.id)).toMatchObject({
				userId: user.id,
				kind: 'level_advanced',
				status: 'pending',
				reviewedAt: null,
				examId: null
			});
			expect(mail.sent).toHaveLength(1);
			expect(mail.sent[0].to).toBe(OFFICE);
			expect(mail.sent[0].text).toContain('Aram');
			expect(mail.sent[0].text).toContain(`${SITE}/admin/exams/applications`);
			expect(await auditFor(tx, 'exam_application', result.id)).toHaveLength(0);
		});
	});

	it('no membership, blocked, already scheduled — refused; advanced applies for level_pro', async () => {
		await inRollback(async (tx) => {
			await setFederationEmail(tx, OFFICE);
			const mail = mailbox();
			const deps = applicationDeps(mail.send);
			const noMember = await insertUser(tx, { emailVerified: true, level: 'novice' });
			expect(await applyForExam(tx, noMember.id, deps, NOW)).toEqual({
				ok: false,
				reason: 'no_membership'
			});
			const blocked = await insertMember(tx, { level: 'novice', status: 'blocked' });
			expect(await applyForExam(tx, blocked.id, deps, NOW)).toEqual({
				ok: false,
				reason: 'blocked'
			});
			const scheduled = await insertMember(tx, { level: 'novice' });
			await insertExam(tx, { userId: scheduled.id, kind: 'level_advanced', result: 'scheduled' });
			expect(await applyForExam(tx, scheduled.id, deps, NOW)).toEqual({
				ok: false,
				reason: 'already_scheduled'
			});
			const advanced = await insertMember(tx, { level: 'advanced' });
			const result = await applyForExam(tx, advanced.id, deps, NOW);
			if (!result.ok) throw new Error(result.reason);
			expect(await applicationRow(tx, result.id)).toMatchObject({
				kind: 'level_pro',
				status: 'pending'
			});
			expect(await applicationsOf(tx, noMember.id)).toEqual([]);
			expect(mail.sent).toHaveLength(1);
		});
	});

	it('pending cannot apply again; rejected returns the same row to pending', async () => {
		await inRollback(async (tx) => {
			await setFederationEmail(tx, OFFICE);
			const user = await insertMember(tx, { level: 'novice' });
			const staff = await insertStaff(tx);
			const first = await applyForExam(tx, user.id, applicationDeps(mailbox().send), NOW);
			if (!first.ok) throw new Error(first.reason);
			const again = () => applyForExam(tx, user.id, applicationDeps(mailbox().send), NOW);
			expect(await again()).toEqual({ ok: false, reason: 'bad_state' });
			expect(
				await rejectExamApplication(
					tx,
					staff,
					first.id,
					{ reason: 'Not ready' },
					applicationDeps(mailbox().send),
					NOW
				)
			).toEqual({ ok: true });
			expect(await again()).toEqual({ ok: true, id: first.id });
			expect(await applicationRow(tx, first.id)).toMatchObject({
				status: 'pending',
				reviewedBy: null,
				reviewedAt: null,
				reviewNote: null
			});
		});
	});

	it('pro has no next exam; unknown user refused; mail failure does not undo', async () => {
		await inRollback(async (tx) => {
			await setFederationEmail(tx, OFFICE);
			const pro = await insertMember(tx, { level: 'pro' });
			expect(await applyForExam(tx, pro.id, applicationDeps(mailbox().send), NOW)).toEqual({
				ok: false,
				reason: 'no_exam'
			});
			expect(
				await applyForExam(tx, crypto.randomUUID(), applicationDeps(mailbox().send), NOW)
			).toEqual({ ok: false, reason: 'not_found' });
			await setFederationEmail(tx, null);
			const quiet = mailbox();
			const novice = await insertMember(tx, { level: 'novice' });
			expect((await applyForExam(tx, novice.id, applicationDeps(quiet.send), NOW)).ok).toBe(true);
			expect(quiet.sent).toHaveLength(0);
			await setFederationEmail(tx, OFFICE);
			const other = await insertMember(tx, { level: 'novice' });
			expect((await applyForExam(tx, other.id, applicationDeps(mailbox(true).send), NOW)).ok).toBe(
				true
			);
		});
	});

	it('scheduling a pending application marks it approved with exam_id and audit', async () => {
		await inRollback(async (tx) => {
			await setFederationEmail(tx, OFFICE);
			const user = await insertMember(tx, { level: 'novice' });
			const staff = await insertStaff(tx);
			const applied = await applyForExam(tx, user.id, applicationDeps(mailbox().send), NOW);
			if (!applied.ok) throw new Error(applied.reason);
			const scheduled = await scheduleExam(
				tx,
				staff,
				{ userId: user.id, kind: 'level_advanced', scheduledAt: week },
				{ settings: NO_LIMITS },
				IP,
				NOW
			);
			if (!scheduled.ok) throw new Error(scheduled.reason);
			expect(await applicationRow(tx, applied.id)).toMatchObject({
				status: 'approved',
				examId: scheduled.id,
				reviewedBy: staff.id
			});
			const [entry] = await auditFor(tx, 'exam_application', applied.id);
			expect(entry).toMatchObject({
				action: 'exam_application.approve',
				actorId: staff.id,
				after: { status: 'approved', examId: scheduled.id, kind: 'level_advanced' }
			});
		});
	});
});
