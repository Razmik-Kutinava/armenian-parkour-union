import { afterAll, describe, expect, it } from 'vitest';
import { testDb, testDbUrl } from '../../db/test-db';
import { auditFor } from '../memberships/test-support';
import { insertMember } from '../registrations/test-support';
import { setFederationEmail } from '../training/test-support';
import { rejectExamApplication } from './application-decide';
import { applyForExam } from './apply';
import { applicationDeps, applicationRow, insertStaff, mailbox, SITE } from './test-support';

/* docs/04 § 7; decisions — docs/todo.md (долг этапа 6). */

const OFFICE = 'office@parkour.test';
const NOW = new Date();

async function pending(tx: Parameters<typeof insertMember>[0]) {
	await setFederationEmail(tx, OFFICE);
	const user = await insertMember(tx, { level: 'novice', firstName: 'Nare', locale: 'en' });
	const applied = await applyForExam(tx, user.id, applicationDeps(mailbox().send), NOW);
	if (!applied.ok) throw new Error(applied.reason);
	return { user, id: applied.id };
}

describe.skipIf(!testDbUrl)('exams: reject an application', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('moderator rejects with a reason: status, audit, letter to the member', async () => {
		await inRollback(async (tx) => {
			const { user, id } = await pending(tx);
			const staff = await insertStaff(tx);
			const mail = mailbox();
			expect(
				await rejectExamApplication(
					tx,
					staff,
					id,
					{ reason: '  Prep more vaults  ' },
					applicationDeps(mail.send),
					NOW
				)
			).toEqual({ ok: true });
			expect(await applicationRow(tx, id)).toMatchObject({
				status: 'rejected',
				reviewNote: 'Prep more vaults',
				reviewedBy: staff.id
			});
			const [entry] = await auditFor(tx, 'exam_application', id);
			expect(entry).toMatchObject({
				action: 'exam_application.reject',
				actorId: staff.id,
				after: { status: 'rejected', reviewNote: 'Prep more vaults', userId: user.id }
			});
			expect(mail.sent).toHaveLength(1);
			expect(mail.sent[0].to).toBe(user.email);
			expect(mail.sent[0].text).toContain('Prep more vaults');
			expect(mail.sent[0].text).toContain(`${SITE}/cabinet/progress`);
		});
	});

	it('editor refused; empty reason invalid; not pending — bad_state', async () => {
		await inRollback(async (tx) => {
			const { id } = await pending(tx);
			const moderator = await insertStaff(tx);
			const deps = applicationDeps(mailbox().send);
			expect(
				await rejectExamApplication(
					tx,
					await insertStaff(tx, 'editor'),
					id,
					{ reason: 'x' },
					deps,
					NOW
				)
			).toEqual({ ok: false, reason: 'not_allowed' });
			expect(await rejectExamApplication(tx, moderator, id, { reason: '   ' }, deps, NOW)).toEqual({
				ok: false,
				reason: 'invalid'
			});
			expect(
				await rejectExamApplication(tx, moderator, crypto.randomUUID(), { reason: 'No' }, deps, NOW)
			).toEqual({ ok: false, reason: 'not_found' });
			await rejectExamApplication(tx, moderator, id, { reason: 'No' }, deps, NOW);
			expect(
				await rejectExamApplication(tx, moderator, id, { reason: 'Again' }, deps, NOW)
			).toEqual({ ok: false, reason: 'bad_state' });
			expect(
				await rejectExamApplication(tx, moderator, 'nope', { reason: 'No' }, deps, NOW)
			).toEqual({ ok: false, reason: 'not_found' });
		});
	});
});
