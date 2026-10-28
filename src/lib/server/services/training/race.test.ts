import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { auditLog } from '../../db/schema/service';
import { exams } from '../../db/schema/certification';
import { courseAccess, quizAttempts } from '../../db/schema/training-progress';
import { testDbUrl } from '../../db/test-db';
import type { Mail } from '../../mail/resend';
import { reviewPractice } from './practice-review';
import { submitPractice } from './practice-submit';
import { setTaskHidden } from './practice-tasks';
import { insertSubmission, submissionRow, YT } from './practice-test-support';
import { quizPage } from './quiz-read';
import { startAttempt } from './quiz-start';
import { submitAttempt } from './quiz-submit';
import { attemptRow, pastAttempt, quizDeps, rightAnswers } from './quiz-test-support';
import { portalRaceDb } from './race-support';
import { accessRow, IP, mailbox, SITE } from './test-support';

/* docs/03 sections 18.3–18.5, roadmap 9.10: the request row is locked first by every write of the
 * portal, so simultaneous clicks are counted once — one attempt, one result, one exam. These
 * tests commit (race-support.ts). */

const DAY = 86_400_000;
const approve = { action: 'approve' as const, comment: '' };
const reviewDeps = (send: (mail: Mail) => Promise<void>) => ({ send, siteUrl: SITE, ip: IP });
const to = (sent: Mail[], email: string) => sent.filter((m) => m.to === email);

describe.skipIf(!testDbUrl)('training portal: simultaneous clicks', () => {
	const db = portalRaceDb();
	afterAll(db.cleanup);

	const attemptsOf = (courseId: string, userId: string) =>
		db.main
			.select()
			.from(quizAttempts)
			.where(and(eq(quizAttempts.courseId, courseId), eq(quizAttempts.userId, userId)));
	const examsOf = (userId: string) => db.main.select().from(exams).where(eq(exams.userId, userId));
	const completions = async (examIds: string[]) =>
		examIds.length === 0
			? []
			: db.main
					.select()
					.from(auditLog)
					.where(
						and(eq(auditLog.action, 'exam.course_complete'), inArray(auditLog.entityId, examIds))
					);

	it('two starts at once: one attempt, the second click sees it running', async () => {
		const { course, member } = await db.quiz();
		const start = (tx: LimitDb) => startAttempt(tx, member, course.slug, quizDeps());
		const [first, second] = await db.race(start, start);
		expect(first).toMatchObject({ ok: true });
		expect(second).toEqual({ ok: false, reason: 'running' });
		expect(await attemptsOf(course.id, member.id)).toHaveLength(1);
	});

	it('two starts at once on the last extra attempt: it is used once', async () => {
		const { course, member, accessId } = await db.quiz();
		await pastAttempt(db.main, course.id, member.id, new Date(Date.now() - DAY));
		await db.main
			.update(courseAccess)
			.set({ extraAttempts: 1 })
			.where(eq(courseAccess.id, accessId));
		const start = (tx: LimitDb) => startAttempt(tx, member, course.slug, quizDeps());
		const [first, second] = await db.race(start, start);
		expect(first).toMatchObject({ ok: true });
		expect(second).toEqual({ ok: false, reason: 'running' });
		const running = (await attemptsOf(course.id, member.id)).filter((a) => a.passed === null);
		expect(running).toHaveLength(1);
		expect(running[0].isExtra).toBe(true);
		expect((await accessRow(db.main, accessId)).extraAttempts).toBe(0);
	});

	it('the same attempt sent twice at once: one result, one letter, one exam', async () => {
		const { course, user, member } = await db.quiz();
		const started = await startAttempt(db.main, member, course.slug, quizDeps());
		if (!started.ok) throw new Error(started.reason);
		const answers = rightAnswers((await attemptRow(db.main, started.id)).questions);
		const box = mailbox();
		const submit = (tx: LimitDb) =>
			submitAttempt(tx, member, course.slug, started.id, answers, {
				...quizDeps(box.send),
				ip: IP
			});
		const [first, second] = await db.race(submit, submit);
		expect(first).toEqual({ ok: true, correct: 4, total: 4, passed: true, expired: false });
		expect(second).toEqual(first);
		expect(await attemptRow(db.main, started.id)).toMatchObject({ correctCount: 4, passed: true });
		const made = await examsOf(member.id);
		expect(made).toHaveLength(1);
		expect(await completions(made.map((e) => e.id))).toHaveLength(1);
		expect(to(box.sent, user.email)).toHaveLength(2);
	});

	it('a late submit and the page closing the same attempt at once: one letter', async () => {
		const { course, user, member } = await db.quiz();
		const past = new Date(Date.now() - 2 * 3_600_000);
		const started = await startAttempt(db.main, member, course.slug, quizDeps(undefined, past));
		if (!started.ok) throw new Error(started.reason);
		const box = mailbox();
		const [sent, page] = await db.race(
			(tx) =>
				submitAttempt(tx, member, course.slug, started.id, [], { ...quizDeps(box.send), ip: IP }),
			(tx) => quizPage(tx, member, course.slug, quizDeps(box.send))
		);
		expect(sent).toMatchObject({ ok: true, passed: false, expired: true });
		expect(page?.running).toBeNull();
		expect(await attemptRow(db.main, started.id)).toMatchObject({ correctCount: 0, passed: false });
		expect(to(box.sent, user.email)).toHaveLength(1);
	});

	it('the last two videos accepted at once by two moderators: one exam', async () => {
		const { user, member, tasks } = await db.practice();
		const [a, b] = await Promise.all([db.staff('moderator'), db.staff('moderator')]);
		const first = await insertSubmission(db.main, tasks[0], member.id, { url: YT(1) });
		const second = await insertSubmission(db.main, tasks[1], member.id, { url: YT(2) });
		const box = mailbox();
		const [x, y] = await db.race(
			(tx) => reviewPractice(tx, a, first, approve, reviewDeps(box.send)),
			(tx) => reviewPractice(tx, b, second, approve, reviewDeps(box.send))
		);
		expect([x, y]).toEqual([{ ok: true }, { ok: true }]);
		const made = await examsOf(member.id);
		expect(made).toHaveLength(1);
		expect(made[0].examinerId).toBe(b.id);
		expect(await completions(made.map((e) => e.id))).toHaveLength(1);
		expect(to(box.sent, user.email)).toHaveLength(3);
	});

	it('the passing quiz and the last video at once: one exam', async () => {
		const { course, user, member, tasks } = await db.practice({ passed: false });
		const moderator = await db.staff('moderator');
		await insertSubmission(db.main, tasks[0], member.id, {
			status: 'approved',
			reviewedBy: moderator.id,
			reviewedAt: new Date(Date.now() - 60_000)
		});
		const last = await insertSubmission(db.main, tasks[1], member.id, { url: YT(2) });
		const started = await startAttempt(db.main, member, course.slug, quizDeps());
		if (!started.ok) throw new Error(started.reason);
		const answers = rightAnswers((await attemptRow(db.main, started.id)).questions);
		const box = mailbox();
		const [quiz, video] = await db.race(
			(tx) =>
				submitAttempt(tx, member, course.slug, started.id, answers, {
					...quizDeps(box.send),
					ip: IP
				}),
			(tx) => reviewPractice(tx, moderator, last, approve, reviewDeps(box.send))
		);
		expect(quiz).toMatchObject({ ok: true, passed: true });
		expect(video).toEqual({ ok: true });
		const made = await examsOf(member.id);
		expect(made).toHaveLength(1);
		expect(await completions(made.map((e) => e.id))).toHaveLength(1);
		expect(to(box.sent, user.email)).toHaveLength(3);
	});

	it('the last task hidden while the member sends a video for it: one exam, the video is refused', async () => {
		const { course, user, member, tasks } = await db.practice();
		const [moderator, admin] = await Promise.all([db.staff('moderator'), db.staff('admin')]);
		await insertSubmission(db.main, tasks[0], member.id, {
			status: 'approved',
			reviewedBy: moderator.id,
			reviewedAt: new Date(Date.now() - 60_000)
		});
		const box = mailbox();
		const [hidden, sent] = await db.race(
			(tx) => setTaskHidden(tx, admin, course.id, tasks[1], true, reviewDeps(box.send)),
			(tx) => submitPractice(tx, member, course.slug, tasks[1], YT(2))
		);
		expect(hidden).toBe('ok');
		expect(sent).toEqual({ ok: false, reason: 'finished' });
		const made = await examsOf(member.id);
		expect(made).toHaveLength(1);
		expect(made[0].examinerId).toBe(moderator.id);
		expect(await completions(made.map((e) => e.id))).toHaveLength(1);
		expect(to(box.sent, user.email)).toHaveLength(1);
	});

	it('one video accepted by two moderators at once: one decision, the second is refused', async () => {
		const { member, tasks } = await db.practice();
		const [a, b] = await Promise.all([db.staff('moderator'), db.staff('moderator')]);
		const id = await insertSubmission(db.main, tasks[0], member.id);
		const box = mailbox();
		const [x, y] = await db.race(
			(tx) => reviewPractice(tx, a, id, approve, reviewDeps(box.send)),
			(tx) => reviewPractice(tx, b, id, approve, reviewDeps(box.send))
		);
		expect(x).toEqual({ ok: true });
		expect(y).toEqual({ ok: false, reason: 'bad_state' });
		expect(await submissionRow(db.main, id)).toMatchObject({
			status: 'approved',
			reviewedBy: a.id
		});
		expect(box.sent).toHaveLength(1);
		expect(await examsOf(member.id)).toHaveLength(0);
	});
});
