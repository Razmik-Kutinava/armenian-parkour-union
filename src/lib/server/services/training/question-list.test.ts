import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { courseTopics } from '../../db/schema/training';
import { testDb, testDbUrl } from '../../db/test-db';
import { getQuestion, listQuestions } from './question-list';
import { createQuestion, setQuestionHidden } from './questions';
import { insertCourse, insertTopic, IP, questionValues, staff } from './test-support';

/* docs/05 section 27 "Question bank": №, topic, text, correct option, source, hidden; filters,
 * search, "questions in the topic / needed in the quiz"; decisions — docs/todo.md 9.3 (6). */

describe.skipIf(!testDbUrl)('training: question bank list', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	async function bank(tx: LimitDb) {
		const admin = await staff(tx);
		const courseId = await insertCourse(tx);
		const a = await insertTopic(tx, courseId, 0);
		const b = await insertTopic(tx, courseId, 1);
		const c = await insertTopic(tx, courseId, 2);
		await tx.update(courseTopics).set({ hiddenAt: new Date() }).where(eq(courseTopics.id, c));
		const add = async (topicId: string, ru: string) => {
			const options = [{ ru: `${ru} нет` }, { ru: `${ru} да` }];
			const values = questionValues(topicId, { text: { ru }, options });
			const made = await createQuestion(tx, admin, courseId, values, IP);
			if (typeof made === 'string') throw new Error(made);
			return made.id;
		};
		const b1 = await add(b, 'Б1 про рейл');
		const a1 = await add(a, 'А1 тест Maddocks');
		const a2 = await add(a, 'А2 жгут');
		await add(c, 'В1 скрытая тема');
		await setQuestionHidden(tx, admin, courseId, a2, true, IP);
		return { courseId, a, b, a1, a2, b1 };
	}

	it('numbered by topic order, then creation; the correct option and the hidden flag', async () => {
		await inRollback(async (tx) => {
			const { courseId, a, a2 } = await bank(tx);
			const list = await listQuestions(tx, courseId, {});
			if (!list) throw new Error('no course');
			expect(list.rows.map((r) => [r.number, r.text.ru, r.hidden])).toEqual([
				[1, 'А1 тест Maddocks', false],
				[2, 'А2 жгут', true],
				[3, 'Б1 про рейл', false],
				[4, 'В1 скрытая тема', false]
			]);
			expect(list.rows[1]).toMatchObject({ id: a2, topicId: a, correct: { ru: 'А2 жгут да' } });
		});
	});

	it('filters keep the numbers; search ignores case', async () => {
		await inRollback(async (tx) => {
			const { courseId, b } = await bank(tx);
			const numbers = async (filter: Parameters<typeof listQuestions>[2]) =>
				(await listQuestions(tx, courseId, filter))?.rows.map((r) => r.number);
			expect(await numbers({ topicId: b })).toEqual([3]);
			expect(await numbers({ state: 'hidden' })).toEqual([2]);
			expect(await numbers({ state: 'visible' })).toEqual([1, 3, 4]);
			expect(await numbers({ q: 'maddocks' })).toEqual([1]);
			expect(await numbers({ q: 'нет такого' })).toEqual([]);
		});
	});

	it('visible questions of visible topics against the quiz; per topic — an even share', async () => {
		await inRollback(async (tx) => {
			const { courseId, a } = await bank(tx);
			const all = await listQuestions(tx, courseId, {});
			expect(all?.stats).toEqual({ quizSize: 27, visible: 2, perTopic: 14, inTopic: null });
			const one = await listQuestions(tx, courseId, { topicId: a });
			expect(one?.stats).toMatchObject({ perTopic: 14, inTopic: 1 });
		});
	});

	it('one question for the form; another course or an unknown id — nothing', async () => {
		await inRollback(async (tx) => {
			const { courseId, a1 } = await bank(tx);
			expect(await getQuestion(tx, courseId, a1)).toMatchObject({
				id: a1,
				text: { ru: 'А1 тест Maddocks' },
				correctIndex: 1,
				hiddenAt: null
			});
			expect(await getQuestion(tx, await insertCourse(tx), a1)).toBeNull();
			expect(await getQuestion(tx, courseId, 'nope')).toBeNull();
			expect(await listQuestions(tx, crypto.randomUUID(), {})).toBeNull();
		});
	});
});
