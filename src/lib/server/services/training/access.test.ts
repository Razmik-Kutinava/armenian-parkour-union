import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { courseAccess } from '../../db/schema/training-progress';
import { users } from '../../db/schema/users';
import { testDb, testDbUrl } from '../../db/test-db';
import { applyForCourse, decideAccess } from './access';
import {
	accessDeps as deps,
	accessRow,
	applicant,
	applied,
	auditOf,
	insertOpenCourse,
	mailbox,
	setFederationEmail,
	SITE,
	staff
} from './test-support';

/* docs/03 sections 18.1 and 18.6, docs/06 section 5.11; decisions — docs/todo.md 9.4 (1, 2, 4). */

const OFFICE = 'office@parkour.test';

describe.skipIf(!testDbUrl)('training access: a request from the cabinet', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a member who meets the conditions applies: pending, a letter to the federation, no audit', async () => {
		await inRollback(async (tx) => {
			await setFederationEmail(tx, OFFICE);
			const course = await insertOpenCourse(tx);
			const user = await applicant(tx, { firstName: 'Aram' });
			const mail = mailbox();
			const result = await applyForCourse(tx, user.id, course.id, deps(mail.send));
			if (!result.ok) throw new Error(result.reason);
			expect(await accessRow(tx, result.id)).toMatchObject({
				courseId: course.id,
				userId: user.id,
				status: 'pending',
				reviewedAt: null
			});
			expect(mail.sent).toHaveLength(1);
			expect(mail.sent[0].to).toBe(OFFICE);
			expect(mail.sent[0].text).toContain('Aram');
			expect(mail.sent[0].text).toContain(`${SITE}/admin/training/access`);
			expect(await auditOf(tx, 'course_access', result.id)).toHaveLength(0);
		});
	});

	it('conditions not met: the missing ones come back, no row, no letter', async () => {
		await inRollback(async (tx) => {
			await setFederationEmail(tx, OFFICE);
			const course = await insertOpenCourse(tx);
			const user = await applicant(tx, { member: false, birthDate: '2015-01-01', level: null });
			const mail = mailbox();
			expect(await applyForCourse(tx, user.id, course.id, deps(mail.send))).toEqual({
				ok: false,
				reason: 'conditions',
				missing: ['membership', 'age', 'level']
			});
			const rows = await tx.select().from(courseAccess).where(eq(courseAccess.userId, user.id));
			expect(rows).toHaveLength(0);
			expect(mail.sent).toHaveLength(0);
		});
	});

	it('a draft or unknown course is not found; a blocked member is refused', async () => {
		await inRollback(async (tx) => {
			const draft = await insertOpenCourse(tx, { status: 'draft' });
			const user = await applicant(tx);
			const send = mailbox().send;
			const refused = (reason: string) => ({ ok: false, reason });
			expect(await applyForCourse(tx, user.id, draft.id, deps(send))).toEqual(
				refused('not_found')
			);
			expect(await applyForCourse(tx, user.id, crypto.randomUUID(), deps(send))).toEqual(
				refused('not_found')
			);
			const open = await insertOpenCourse(tx);
			await tx.update(users).set({ status: 'blocked' }).where(eq(users.id, user.id));
			expect(await applyForCourse(tx, user.id, open.id, deps(send))).toEqual(refused('blocked'));
		});
	});

	it('pending, approved or revoked cannot apply again; rejected returns the same row to pending', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const { course, user, id } = await applied(tx);
			const again = () => applyForCourse(tx, user.id, course.id, deps(mailbox().send));
			const badState = { ok: false, reason: 'bad_state' };
			expect(await again()).toEqual(badState);
			const reject = { action: 'reject' as const, reason: 'Нет видео' };
			expect(await decideAccess(tx, admin, id, reject, deps(mailbox().send))).toEqual({
				ok: true
			});
			expect(await again()).toEqual({ ok: true, id });
			expect(await accessRow(tx, id)).toMatchObject({
				status: 'pending',
				reviewedBy: null,
				reviewedAt: null,
				reviewNote: null
			});
			await decideAccess(tx, admin, id, { action: 'approve' }, deps(mailbox().send));
			expect(await again()).toEqual(badState);
			const revoke = { action: 'revoke' as const, reason: 'Нарушение кодекса' };
			await decideAccess(tx, admin, id, revoke, deps(mailbox().send));
			expect(await again()).toEqual(badState);
		});
	});

	it('no federation address or a failing mail service does not undo the request', async () => {
		await inRollback(async (tx) => {
			await setFederationEmail(tx, null);
			const user = await applicant(tx);
			const quiet = mailbox();
			const course = await insertOpenCourse(tx);
			expect((await applyForCourse(tx, user.id, course.id, deps(quiet.send))).ok).toBe(true);
			expect(quiet.sent).toHaveLength(0);
			await setFederationEmail(tx, OFFICE);
			const other = await insertOpenCourse(tx);
			const down = mailbox(true);
			expect((await applyForCourse(tx, user.id, other.id, deps(down.send))).ok).toBe(true);
		});
	});
});
