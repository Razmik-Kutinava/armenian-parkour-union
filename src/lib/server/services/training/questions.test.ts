import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { courseTopics, quizQuestions } from '../../db/schema/training';
import { testDb, testDbUrl } from '../../db/test-db';
import { createQuestion, setQuestionHidden, updateQuestion } from './questions';
import { auditOf, insertCourse, insertTopic, IP, questionValues, staff } from './test-support';

/* docs/05 section 27 "Question bank", docs/03 section 18.6; decisions — docs/todo.md 9.3 (5). */

describe.skipIf(!testDbUrl)('training: question bank', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a question only in Russian is created by its author and logged in full', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const courseId = await insertCourse(tx);
			const topicId = await insertTopic(tx, courseId);
			const values = questionValues(topicId, { source: 'Первая помощь, раздел 3.2' });
			const result = await createQuestion(tx, admin, courseId, values, IP);
			if (typeof result === 'string') throw new Error(result);
			const [row] = await tx.select().from(quizQuestions).where(eq(quizQuestions.id, result.id));
			expect(row).toMatchObject({ ...values, courseId, createdBy: admin.id, hiddenAt: null });
			const [entry] = await auditOf(tx, 'quiz_question', result.id);
			expect(entry).toMatchObject({
				action: 'quiz_question.create',
				actorId: admin.id,
				ip: IP,
				after: { courseId, ...values }
			});
		});
	});

	it('a hidden topic of the course is allowed; a topic of another course is not', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const courseId = await insertCourse(tx);
			const other = await insertTopic(tx, await insertCourse(tx));
			const hidden = await insertTopic(tx, courseId);
			await tx
				.update(courseTopics)
				.set({ hiddenAt: new Date() })
				.where(eq(courseTopics.id, hidden));
			const made = await createQuestion(tx, admin, courseId, questionValues(hidden), IP);
			expect(made).toMatchObject({ id: expect.any(String) });
			expect(await createQuestion(tx, admin, courseId, questionValues(other), IP)).toBe(
				'bad_topic'
			);
			if (typeof made === 'string') throw new Error(made);
			expect(await updateQuestion(tx, admin, courseId, made.id, questionValues(other), IP)).toBe(
				'bad_topic'
			);
			const fresh = questionValues(hidden);
			expect(await createQuestion(tx, admin, crypto.randomUUID(), fresh, IP)).toBe('not_found');
		});
	});

	it('an edit logs only the changed fields, the correct answer too; no change — no entry', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const courseId = await insertCourse(tx);
			const topicId = await insertTopic(tx, courseId);
			const values = questionValues(topicId);
			const made = await createQuestion(tx, admin, courseId, values, IP);
			if (typeof made === 'string') throw new Error(made);
			expect(await updateQuestion(tx, admin, courseId, made.id, values, IP)).toBe('ok');
			expect(await auditOf(tx, 'quiz_question', made.id)).toHaveLength(1);
			const changed = { ...values, correctIndex: 2, source: 'Раздел 3.2' };
			expect(await updateQuestion(tx, admin, courseId, made.id, changed, IP)).toBe('ok');
			const entries = await auditOf(tx, 'quiz_question', made.id);
			expect(entries[1]).toMatchObject({
				action: 'quiz_question.update',
				before: { correctIndex: 1, source: null },
				after: { correctIndex: 2, source: 'Раздел 3.2' }
			});
			expect(Object.keys(entries[1].after as object).sort()).toEqual(['correctIndex', 'source']);
			const [row] = await tx.select().from(quizQuestions).where(eq(quizQuestions.id, made.id));
			expect(row).toMatchObject({ correctIndex: 2, source: 'Раздел 3.2' });
		});
	});

	it('hide and restore, a repeat is refused; a hidden question can be edited', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const courseId = await insertCourse(tx);
			const topicId = await insertTopic(tx, courseId);
			const made = await createQuestion(tx, admin, courseId, questionValues(topicId), IP);
			if (typeof made === 'string') throw new Error(made);
			expect(await setQuestionHidden(tx, admin, courseId, made.id, true, IP)).toBe('ok');
			expect(await setQuestionHidden(tx, admin, courseId, made.id, true, IP)).toBe('bad_state');
			const text = { ru: 'Новый текст' };
			const edit = questionValues(topicId, { text });
			expect(await updateQuestion(tx, admin, courseId, made.id, edit, IP)).toBe('ok');
			const [row] = await tx.select().from(quizQuestions).where(eq(quizQuestions.id, made.id));
			expect(row.hiddenAt).toBeInstanceOf(Date);
			expect(row.text).toEqual(text);
			expect(await setQuestionHidden(tx, admin, courseId, made.id, false, IP)).toBe('ok');
			const actions = (await auditOf(tx, 'quiz_question', made.id)).map((e) => e.action);
			expect(actions).toEqual([
				'quiz_question.create',
				'quiz_question.hide',
				'quiz_question.update',
				'quiz_question.restore'
			]);
		});
	});

	it('only an admin manages the bank; a question of another course is not found', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const courseId = await insertCourse(tx);
			const otherCourse = await insertCourse(tx);
			const topicId = await insertTopic(tx, courseId);
			const values = questionValues(topicId);
			const made = await createQuestion(tx, admin, courseId, values, IP);
			if (typeof made === 'string') throw new Error(made);
			for (const role of ['editor', 'moderator', 'member'] as const) {
				const actor = await staff(tx, role);
				expect(await createQuestion(tx, actor, courseId, values, IP)).toBe('not_allowed');
				expect(await updateQuestion(tx, actor, courseId, made.id, values, IP)).toBe('not_allowed');
				expect(await setQuestionHidden(tx, actor, courseId, made.id, true, IP)).toBe('not_allowed');
			}
			expect(await updateQuestion(tx, admin, otherCourse, made.id, values, IP)).toBe('not_found');
			expect(await setQuestionHidden(tx, admin, otherCourse, made.id, true, IP)).toBe('not_found');
			expect(await updateQuestion(tx, admin, courseId, 'nope', values, IP)).toBe('not_found');
		});
	});
});
