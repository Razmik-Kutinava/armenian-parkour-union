import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { memberships } from '../../db/schema/payments';
import { testDb, testDbUrl } from '../../db/test-db';
import { decideAccess } from './access';
import {
	accessDeps as deps,
	accessRow,
	applied,
	auditOf,
	IP,
	mailbox,
	SITE,
	staff
} from './test-support';

/* docs/03 sections 18.1 and 18.6, docs/05 section 27 "Requests"; decisions — docs/todo.md 9.4 (3, 4). */

const badState = { ok: false, reason: 'bad_state' };

describe.skipIf(!testDbUrl)('training access: decisions of an admin', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('approve: approved by the admin, logged, a letter with the portal link in the member language', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const { course, user, id } = await applied(tx, { locale: 'ru' });
			const mail = mailbox();
			const result = await decideAccess(tx, admin, id, { action: 'approve' }, deps(mail.send));
			expect(result).toEqual({ ok: true });
			expect(await accessRow(tx, id)).toMatchObject({
				status: 'approved',
				reviewedBy: admin.id,
				reviewNote: null
			});
			const [entry] = await auditOf(tx, 'course_access', id);
			expect(entry).toMatchObject({
				action: 'course_access.approve',
				actorId: admin.id,
				ip: IP,
				before: { status: 'pending' },
				after: { status: 'approved', courseId: course.id, userId: user.id }
			});
			expect(mail.sent).toHaveLength(1);
			expect(mail.sent[0].to).toBe(user.email);
			expect(mail.sent[0].text).toContain(`${SITE}/ru/cabinet/training/${course.slug}`);
		});
	});

	it('approve checks the conditions again: a membership that ended keeps the request pending', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const { user, id } = await applied(tx);
			await tx
				.update(memberships)
				.set({ endsAt: new Date(Date.now() - 86_400_000) })
				.where(eq(memberships.userId, user.id));
			const mail = mailbox();
			expect(await decideAccess(tx, admin, id, { action: 'approve' }, deps(mail.send))).toEqual({
				ok: false,
				reason: 'conditions',
				missing: ['membership']
			});
			expect((await accessRow(tx, id)).status).toBe('pending');
			expect(await auditOf(tx, 'course_access', id)).toHaveLength(0);
			expect(mail.sent).toHaveLength(0);
		});
	});

	it('reject needs a reason; the reason is stored, logged and sent to the member', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const { user, id } = await applied(tx);
			const mail = mailbox();
			const blank = { action: 'reject' as const, reason: '   ' };
			expect(await decideAccess(tx, admin, id, blank, deps(mail.send))).toEqual({
				ok: false,
				reason: 'invalid'
			});
			const reject = { action: 'reject' as const, reason: '  Нужна справка  ' };
			expect(await decideAccess(tx, admin, id, reject, deps(mail.send))).toEqual({ ok: true });
			expect(await accessRow(tx, id)).toMatchObject({
				status: 'rejected',
				reviewedBy: admin.id,
				reviewNote: 'Нужна справка'
			});
			const [entry] = await auditOf(tx, 'course_access', id);
			expect(entry).toMatchObject({
				action: 'course_access.reject',
				after: { status: 'rejected', reviewNote: 'Нужна справка' }
			});
			expect(mail.sent.map((m) => m.to)).toEqual([user.email]);
			expect(mail.sent[0].text).toContain('Нужна справка');
		});
	});

	it('revoke only an approved one, with a reason; approve and reject only a pending one', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const { user, id } = await applied(tx);
			const send = mailbox().send;
			const revoke = { action: 'revoke' as const, reason: 'Нарушение кодекса' };
			expect(await decideAccess(tx, admin, id, revoke, deps(send))).toEqual(badState);
			await decideAccess(tx, admin, id, { action: 'approve' }, deps(send));
			expect(await decideAccess(tx, admin, id, { action: 'approve' }, deps(send))).toEqual(
				badState
			);
			const reject = { action: 'reject' as const, reason: 'Поздно' };
			expect(await decideAccess(tx, admin, id, reject, deps(send))).toEqual(badState);
			const mail = mailbox();
			expect(await decideAccess(tx, admin, id, revoke, deps(mail.send))).toEqual({ ok: true });
			expect(await accessRow(tx, id)).toMatchObject({
				status: 'revoked',
				reviewNote: 'Нарушение кодекса'
			});
			const actions = (await auditOf(tx, 'course_access', id)).map((e) => e.action);
			expect(actions).toEqual(['course_access.approve', 'course_access.revoke']);
			expect(mail.sent.map((m) => m.to)).toEqual([user.email]);
			expect(mail.sent[0].text).toContain('Нарушение кодекса');
		});
	});

	it('only an admin decides; an unknown request is not found', async () => {
		await inRollback(async (tx) => {
			const { id } = await applied(tx);
			const send = mailbox().send;
			for (const role of ['editor', 'moderator', 'member'] as const) {
				const actor = await staff(tx, role);
				expect(await decideAccess(tx, actor, id, { action: 'approve' }, deps(send))).toEqual({
					ok: false,
					reason: 'not_allowed'
				});
			}
			expect((await accessRow(tx, id)).status).toBe('pending');
			const admin = await staff(tx);
			const unknown = crypto.randomUUID();
			expect(await decideAccess(tx, admin, unknown, { action: 'approve' }, deps(send))).toEqual({
				ok: false,
				reason: 'not_found'
			});
		});
	});
});
