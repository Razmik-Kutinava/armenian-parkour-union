import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { courseAccess } from '../../db/schema/training-progress';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { attemptDetail, attemptFilter, listAttempts } from './attempt-list';
import { pastAttempt, quizCourse } from './quiz-test-support';

/* docs/05 section 27 "Attempts" (moderator read, admin): the list with filters course, result,
 * period, and the card with the snapshot, the answers and the limit from the course settings.
 * Decisions — docs/todo.md 9.11. */

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const snapshot = [
	{ question_id: 'q1', text: { ru: 'Вопрос 1' }, options: [{ ru: 'А' }, { ru: 'Б' }], correct_index: 1 },
	{ question_id: 'q2', text: { ru: 'Вопрос 2' }, options: [{ ru: 'В' }, { ru: 'Г' }], correct_index: 0 },
	{ question_id: 'q3', text: { ru: 'Вопрос 3' }, options: [{ ru: 'Д' }, { ru: 'Е' }], correct_index: 0 }
];
const base = { courseId: null, result: 'all', from: null, to: null, page: 1 } as const;

describe('attemptFilter', () => {
	const state = (filters: Record<string, string>, q?: string) => ({
		page: 2,
		q,
		sort: { key: 'started', dir: 'desc' as const },
		filters
	});
	it('keeps known values and drops the rest', () => {
		const id = crypto.randomUUID();
		expect(attemptFilter(state({ course: id, result: 'failed', from: '2026-01-31' }, 'Ann'))).toEqual(
			{ courseId: id, result: 'failed', from: '2026-01-31', to: null, page: 2, q: 'Ann' }
		);
		expect(attemptFilter(state({ course: 'x', result: 'odd', from: '2026-02-30', to: '1' }))).toEqual(
			{ courseId: null, result: 'all', from: null, to: null, page: 2, q: undefined }
		);
	});
});

describe.skipIf(!testDbUrl)('training attempts: the admin list and card', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('newest first; filters by course, result, period in Yerevan days; searches the name', async () => {
		await inRollback(async (tx) => {
			const a = await quizCourse(tx);
			const b = await quizCourse(tx);
			const passed = await pastAttempt(tx, a.course.id, a.user.id, ago(10), {
				passed: true,
				correctCount: 4,
				isExtra: true
			});
			const failed = await pastAttempt(tx, b.course.id, b.user.id, ago(5));
			const running = await pastAttempt(tx, a.course.id, a.user.id, ago(0), {
				startedAt: new Date(Date.now() - 60_000),
				expiresAt: new Date(Date.now() + 3_000_000),
				submittedAt: null,
				passed: null,
				correctCount: null
			});
			const expired = await pastAttempt(tx, b.course.id, b.user.id, ago(1), {
				submittedAt: null,
				passed: null,
				correctCount: null
			});
			/* 01:30 on 2020-03-11 in Yerevan (UTC+4). */
			const night = await pastAttempt(tx, a.course.id, a.user.id, new Date('2020-03-10T21:30:00Z'));
			const ours = [passed, failed, running, expired, night];
			const ids = async (filter: Parameters<typeof listAttempts>[1]) =>
				(await listAttempts(tx, filter)).rows.map((r) => r.id).filter((id) => ours.includes(id));

			expect(await ids(base)).toEqual([running, expired, failed, passed, night]);
			expect(await ids({ ...base, courseId: a.course.id })).toEqual([running, passed, night]);
			expect(await ids({ ...base, result: 'passed' })).toEqual([passed]);
			expect(await ids({ ...base, result: 'failed' })).toEqual([failed, night]);
			expect(await ids({ ...base, result: 'running' })).toEqual([running, expired]);
			expect(await ids({ ...base, from: '2020-03-11', to: '2020-03-11' })).toEqual([night]);
			expect(await ids({ ...base, from: '2020-03-01', to: '2020-03-10' })).toEqual([]);
			expect(await ids({ ...base, q: b.user.tag.slice(0, 8) })).toEqual([expired, failed]);

			const rows = (await listAttempts(tx, { ...base, courseId: a.course.id })).rows;
			expect(rows.find((r) => r.id === passed)).toMatchObject({
				userId: a.user.id,
				name: `Test ${a.user.tag}`,
				courseId: a.course.id,
				courseTitle: { ru: 'Курс тренера', en: 'Coach course' },
				correctCount: 4,
				total: 4,
				isExtra: true,
				result: 'passed'
			});
			expect(rows.find((r) => r.id === running)?.result).toBe('running');
			const bRows = (await listAttempts(tx, { ...base, courseId: b.course.id })).rows;
			expect(bRows.find((r) => r.id === expired)?.result).toBe('expired');
			expect(bRows.find((r) => r.id === failed)?.result).toBe('failed');
		});
	});

	it('the card: snapshot questions, the answer and the right one; the limit from the course', async () => {
		await inRollback(async (tx) => {
			const { course, user } = await quizCourse(tx, { attemptsLimit: 5, attemptsPeriodDays: 90 });
			await tx
				.update(courseAccess)
				.set({ extraAttempts: 2 })
				.where(eq(courseAccess.userId, user.id));
			await pastAttempt(tx, course.id, user.id, ago(100));
			await pastAttempt(tx, course.id, user.id, ago(60));
			await pastAttempt(tx, course.id, user.id, ago(40), { isExtra: true });
			const started = ago(20);
			const id = await pastAttempt(tx, course.id, user.id, started, {
				questions: snapshot,
				answers: [1, 1, null],
				total: 3,
				passCount: 2,
				correctCount: 1
			});
			const card = await attemptDetail(tx, id);
			expect(card).toMatchObject({
				id,
				userId: user.id,
				courseTitle: { ru: 'Курс тренера', en: 'Coach course' },
				total: 3,
				passCount: 2,
				correctCount: 1,
				result: 'failed',
				isExtra: false,
				limit: { used: 2, limit: 5, periodDays: 90, extra: 2 }
			});
			expect(card?.startedAt).toEqual(started);
			expect(card?.endedAt).toEqual(new Date(started.getTime() + 600_000));
			expect(card?.questions).toEqual([
				{ text: { ru: 'Вопрос 1' }, options: [{ ru: 'А' }, { ru: 'Б' }], answer: 1, correct: 1 },
				{ text: { ru: 'Вопрос 2' }, options: [{ ru: 'В' }, { ru: 'Г' }], answer: 1, correct: 0 },
				{ text: { ru: 'Вопрос 3' }, options: [{ ru: 'Д' }, { ru: 'Е' }], answer: null, correct: 0 }
			]);
		});
	});

	it('a running attempt shows no questions; an expired unsettled one does; unknown ids — null', async () => {
		await inRollback(async (tx) => {
			const { course, user } = await quizCourse(tx);
			const open = {
				questions: snapshot,
				answers: [1, null, null],
				total: 3,
				submittedAt: null,
				passed: null,
				correctCount: null
			};
			const running = await pastAttempt(tx, course.id, user.id, new Date(Date.now() - 60_000), {
				...open,
				expiresAt: new Date(Date.now() + 3_000_000)
			});
			const card = await attemptDetail(tx, running);
			expect(card).toMatchObject({ result: 'running', questions: null });
			expect(JSON.stringify(card)).not.toMatch(/correct_?index|"correct"/i);

			const stranger = await insertUser(tx);
			const late = await pastAttempt(tx, course.id, stranger.id, ago(2), open);
			const lateCard = await attemptDetail(tx, late);
			expect(lateCard?.result).toBe('expired');
			expect(lateCard?.questions?.map((q) => [q.answer, q.correct])).toEqual([
				[1, 1],
				[null, 0],
				[null, 0]
			]);
			expect(lateCard?.limit.extra).toBe(0);

			const deleted = await insertUser(tx, { deletedAt: new Date() });
			const gone = await pastAttempt(tx, course.id, deleted.id, ago(3));
			expect((await attemptDetail(tx, gone))?.name).toBe(`Test ${deleted.tag}`);
			expect(await attemptDetail(tx, crypto.randomUUID())).toBeNull();
			expect(await attemptDetail(tx, 'nope')).toBeNull();
		});
	});
});
