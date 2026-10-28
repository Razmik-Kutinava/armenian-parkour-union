import { afterAll, describe, expect, it } from 'vitest';
import { testDb, testDbUrl } from '../../db/test-db';
import { reviewPractice } from './practice-review';
import { insertSubmission, practiceCourse, submissionRow, YT } from './practice-test-support';
import { auditOf, IP, mailbox, SITE, staff } from './test-support';

/* docs/03 sections 18.4 p. 4–5, 18.6; docs/05 section 27 "Practice"; docs/04 `training.review`;
 * decisions — docs/todo.md 9.7 (4, 8), 9.14 (1–5). */

const deps = (send = mailbox().send) => ({ send, siteUrl: SITE, ip: IP });
const refused = (reason: string) => ({ ok: false, reason });

describe.skipIf(!testDbUrl)('training practice: the review', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('moderator accepts: logged, the member gets a letter in their language', async () => {
		await inRollback(async (tx) => {
			const { course, member, tasks } = await practiceCourse(tx, { locale: 'ru' });
			const id = await insertSubmission(tx, tasks[0], member.id);
			const moderator = await staff(tx, 'moderator');
			const box = mailbox();
			const input = { action: 'approve' as const, comment: '', url: YT(1) };
			expect(await reviewPractice(tx, moderator, id, input, deps(box.send))).toEqual({ ok: true });
			expect(await submissionRow(tx, id)).toMatchObject({
				status: 'approved',
				reviewedBy: moderator.id,
				reviewNote: null
			});
			expect((await submissionRow(tx, id)).reviewedAt).toBeInstanceOf(Date);
			const [entry] = await auditOf(tx, 'practice_submission', id);
			expect(entry).toMatchObject({
				action: 'practice_submission.approve',
				actorId: moderator.id,
				ip: IP,
				before: { status: 'pending' },
				after: { status: 'approved', taskId: tasks[0], userId: member.id }
			});
			expect(box.sent).toHaveLength(1);
			expect(box.sent[0].subject).toMatch(/принято/i);
			expect(box.sent[0].text).toContain('Задание 0');
			expect(box.sent[0].text).toContain(`${SITE}/ru/cabinet/training/${course.slug}/practice`);
		});
	});

	it('admin returns with a comment; without a comment — refused, nothing changes', async () => {
		await inRollback(async (tx) => {
			const { member, tasks } = await practiceCourse(tx, { locale: 'en' });
			const id = await insertSubmission(tx, tasks[0], member.id);
			const admin = await staff(tx);
			const box = mailbox();
			const blank = { action: 'reject' as const, comment: '   ', url: YT(1) };
			expect(await reviewPractice(tx, admin, id, blank, deps(box.send))).toEqual(
				refused('invalid')
			);
			const long = { action: 'reject' as const, comment: 'x'.repeat(1001), url: YT(1) };
			expect(await reviewPractice(tx, admin, id, long, deps(box.send))).toEqual(refused('invalid'));
			expect((await submissionRow(tx, id)).status).toBe('pending');
			const input = {
				action: 'reject' as const,
				comment: ' The landing is not visible ',
				url: YT(1)
			};
			expect(await reviewPractice(tx, admin, id, input, deps(box.send))).toEqual({ ok: true });
			expect(await submissionRow(tx, id)).toMatchObject({
				status: 'rejected',
				reviewNote: 'The landing is not visible'
			});
			const [entry] = await auditOf(tx, 'practice_submission', id);
			expect(entry).toMatchObject({
				action: 'practice_submission.reject',
				after: { status: 'rejected', reviewNote: 'The landing is not visible' }
			});
			expect(box.sent).toHaveLength(1);
			expect(box.sent[0].text).toContain('The landing is not visible');
		});
	});

	it('a decided submission is not decided again; an accepted one is never withdrawn', async () => {
		await inRollback(async (tx) => {
			const { member, tasks } = await practiceCourse(tx);
			const id = await insertSubmission(tx, tasks[0], member.id);
			const admin = await staff(tx);
			const box = mailbox();
			await reviewPractice(
				tx,
				admin,
				id,
				{ action: 'approve', comment: '', url: YT(1) },
				deps(box.send)
			);
			const again = { action: 'reject' as const, comment: 'Передумал', url: YT(2) };
			expect(await reviewPractice(tx, admin, id, again, deps(box.send))).toEqual(
				refused('bad_state')
			);
			expect((await submissionRow(tx, id)).status).toBe('approved');
			expect(box.sent).toHaveLength(1);
			expect(await auditOf(tx, 'practice_submission', id)).toHaveLength(1);
		});
	});

	it('the member replaced the link after the card was shown — refused, nothing written', async () => {
		await inRollback(async (tx) => {
			const { member, tasks } = await practiceCourse(tx);
			const id = await insertSubmission(tx, tasks[0], member.id, { url: YT(2) });
			const admin = await staff(tx);
			const box = mailbox();
			for (const input of [
				{ action: 'approve' as const, comment: '', url: YT(1) },
				{ action: 'approve' as const, comment: '', url: '' },
				{ action: 'reject' as const, comment: 'No landing', url: YT(1) }
			]) {
				expect(await reviewPractice(tx, admin, id, input, deps(box.send))).toEqual(
					refused('changed')
				);
			}
			expect(await submissionRow(tx, id)).toMatchObject({ status: 'pending', reviewedBy: null });
			expect(await auditOf(tx, 'practice_submission', id)).toHaveLength(0);
			expect(box.sent).toHaveLength(0);
			const shown = { action: 'approve' as const, comment: '', url: YT(2) };
			expect(await reviewPractice(tx, admin, id, shown, deps(box.send))).toEqual({ ok: true });
		});
	});

	it('own video — refused even to an admin; editor and member — not allowed', async () => {
		await inRollback(async (tx) => {
			const { member, tasks } = await practiceCourse(tx);
			const admin = await staff(tx);
			const own = await insertSubmission(tx, tasks[0], admin.id, { url: YT(7) });
			const input = { action: 'approve' as const, comment: '', url: YT(1) };
			expect(await reviewPractice(tx, admin, own, input, deps())).toEqual(refused('own'));
			const id = await insertSubmission(tx, tasks[1], member.id);
			for (const actor of [await staff(tx, 'editor'), member]) {
				expect(await reviewPractice(tx, actor, id, input, deps())).toEqual(refused('not_allowed'));
			}
			expect((await submissionRow(tx, own)).status).toBe('pending');
			expect((await submissionRow(tx, id)).status).toBe('pending');
		});
	});

	it('an unknown or malformed id — not found', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const input = { action: 'approve' as const, comment: '', url: YT(1) };
			for (const id of [crypto.randomUUID(), 'nope']) {
				expect(await reviewPractice(tx, admin, id, input, deps())).toEqual(refused('not_found'));
			}
		});
	});

	it('a failing mail service does not undo the decision', async () => {
		await inRollback(async (tx) => {
			const { member, tasks } = await practiceCourse(tx);
			const id = await insertSubmission(tx, tasks[0], member.id);
			const admin = await staff(tx);
			const input = { action: 'approve' as const, comment: '', url: YT(1) };
			expect(await reviewPractice(tx, admin, id, input, deps(mailbox(true).send))).toEqual({
				ok: true
			});
			expect((await submissionRow(tx, id)).status).toBe('approved');
		});
	});
});
