import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { courseLessons, quizQuestions } from '../../db/schema/training';
import { testDb, testDbUrl } from '../../db/test-db';
import { createTopic, listTopics, moveTopic, setTopicHidden, updateTopic } from './topics';
import { auditOf, insertCourse, IP, staff } from './test-support';

/* docs/05 section 27 "Topics"; decisions — docs/todo.md 9.2 (3, 4). */

type Admin = { id: string; role: 'admin' };

async function topic(tx: LimitDb, admin: Admin, courseId: string, en: string) {
	const result = await createTopic(tx, admin, courseId, { title: { en } }, IP);
	if (typeof result === 'string') throw new Error(result);
	return result.id;
}

const titles = async (tx: LimitDb, courseId: string) =>
	(await listTopics(tx, courseId)).map((t) => (t.title as { en: string }).en);

describe.skipIf(!testDbUrl)('training: course topics', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a new topic goes to the end; creation and rename are logged', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const courseId = await insertCourse(tx);
			await topic(tx, admin, courseId, 'Safety');
			const second = await topic(tx, admin, courseId, 'Coaching');
			expect(await titles(tx, courseId)).toEqual(['Safety', 'Coaching']);
			const title = { en: 'Coaching basics', ru: 'Основы' };
			expect(await updateTopic(tx, admin, courseId, second, { title }, IP)).toBe('ok');
			expect((await listTopics(tx, courseId))[1].title).toEqual(title);
			const entries = await auditOf(tx, 'course_topic', second);
			expect(entries.map((e) => e.action)).toEqual(['course_topic.create', 'course_topic.update']);
			expect(entries[1]).toMatchObject({ actorId: admin.id, ip: IP, after: { title } });
		});
	});

	it('up and down swap with the neighbour; at the edge nothing changes', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const courseId = await insertCourse(tx);
			const a = await topic(tx, admin, courseId, 'A');
			const b = await topic(tx, admin, courseId, 'B');
			await topic(tx, admin, courseId, 'C');
			expect(await moveTopic(tx, admin, courseId, b, 'up', IP)).toBe('ok');
			expect(await titles(tx, courseId)).toEqual(['B', 'A', 'C']);
			expect(await moveTopic(tx, admin, courseId, a, 'down', IP)).toBe('ok');
			expect(await titles(tx, courseId)).toEqual(['B', 'C', 'A']);
			expect(await moveTopic(tx, admin, courseId, b, 'up', IP)).toBe('ok');
			expect(await titles(tx, courseId)).toEqual(['B', 'C', 'A']);
			const moves = (await auditOf(tx, 'course_topic', a)).filter(
				(e) => e.action === 'course_topic.reorder'
			);
			expect(moves).toHaveLength(1);
			expect((await auditOf(tx, 'course_topic', b)).at(-1)?.action).toBe('course_topic.reorder');
		});
	});

	it('hide and restore; a repeat is refused; the row counts lessons and visible questions', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const courseId = await insertCourse(tx);
			const id = await topic(tx, admin, courseId, 'Rules');
			await tx.insert(courseLessons).values([
				{ courseId, topicId: id, title: { en: 'L1' } },
				{ courseId, topicId: id, title: { en: 'L2' }, deletedAt: new Date() }
			]);
			const q = { courseId, topicId: id, text: { en: 'Q' }, correctIndex: 1 };
			const options = [{ en: 'A' }, { en: 'B' }];
			await tx.insert(quizQuestions).values([
				{ ...q, options },
				{ ...q, options },
				{ ...q, options, hiddenAt: new Date() }
			]);
			expect((await listTopics(tx, courseId))[0]).toMatchObject({ lessons: 1, questions: 2 });
			expect(await setTopicHidden(tx, admin, courseId, id, true, IP)).toBe('ok');
			expect((await listTopics(tx, courseId))[0].hiddenAt).toBeInstanceOf(Date);
			expect(await setTopicHidden(tx, admin, courseId, id, true, IP)).toBe('bad_state');
			expect(await setTopicHidden(tx, admin, courseId, id, false, IP)).toBe('ok');
			expect((await listTopics(tx, courseId))[0].hiddenAt).toBeNull();
			const actions = (await auditOf(tx, 'course_topic', id)).map((e) => e.action);
			expect(actions).toEqual(['course_topic.create', 'course_topic.hide', 'course_topic.restore']);
		});
	});

	it('only an admin manages topics; a topic of another course is not found', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const courseId = await insertCourse(tx);
			const other = await insertCourse(tx);
			const id = await topic(tx, admin, courseId, 'Mine');
			const title = { title: { en: 'X' } };
			for (const role of ['editor', 'moderator', 'member'] as const) {
				const actor = await staff(tx, role);
				expect(await createTopic(tx, actor, courseId, title, IP)).toBe('not_allowed');
				expect(await updateTopic(tx, actor, courseId, id, title, IP)).toBe('not_allowed');
				expect(await moveTopic(tx, actor, courseId, id, 'down', IP)).toBe('not_allowed');
				expect(await setTopicHidden(tx, actor, courseId, id, true, IP)).toBe('not_allowed');
			}
			expect(await updateTopic(tx, admin, other, id, title, IP)).toBe('not_found');
			expect(await setTopicHidden(tx, admin, other, id, true, IP)).toBe('not_found');
			expect(await moveTopic(tx, admin, other, id, 'up', IP)).toBe('not_found');
			expect(await createTopic(tx, admin, crypto.randomUUID(), title, IP)).toBe('not_found');
			expect(await updateTopic(tx, admin, courseId, 'nope', title, IP)).toBe('not_found');
		});
	});
});
