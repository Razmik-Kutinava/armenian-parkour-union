import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { quizBankFileSchema } from '#lib/validation/training-questions.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { auditLog } from '../../db/schema/service';
import { courses, courseTopics, quizQuestions } from '../../db/schema/training';
import { testDb, testDbUrl } from '../../db/test-db';
import { importQuizBank } from './question-import';
import { createTopic } from './topics';
import { IP, staff } from './test-support';

/* Import of the prepared bank file (roadmap 9.3); decisions — docs/todo.md 9.3 (7). */

const question = (ru: string) => ({
	text: { ru },
	options: [{ ru: 'А' }, { ru: 'Б' }, { ru: 'В' }],
	correct: 1,
	source: 'Раздел 1'
});
const file = (slug: string) =>
	quizBankFileSchema.parse({
		course: {
			slug,
			examKind: 'trainer',
			title: { ru: 'Курс тренера' },
			status: 'draft',
			quizSize: 27,
			passCount: 25,
			quizMinutes: 60,
			retakeDays: 30,
			attemptsLimit: 3,
			attemptsPeriodDays: 180,
			requiresMembership: true,
			minAge: 18,
			requiredLevel: 'advanced'
		},
		topics: [
			{ title: { ru: 'УТП 1-го года' }, questions: [question('Вопрос 1'), question('Вопрос 2')] },
			{ title: { ru: 'Первая помощь' }, questions: [question('Вопрос 3')] }
		]
	});
const slug = () => `t-bank-${crypto.randomUUID().slice(0, 8)}`;

async function rows(tx: LimitDb, courseSlug: string) {
	const [course] = await tx.select().from(courses).where(eq(courses.slug, courseSlug));
	if (!course) return null;
	const topics = await tx
		.select()
		.from(courseTopics)
		.where(eq(courseTopics.courseId, course.id))
		.orderBy(courseTopics.sortOrder);
	const questions = await tx
		.select()
		.from(quizQuestions)
		.where(eq(quizQuestions.courseId, course.id));
	return { course, topics, questions };
}

describe.skipIf(!testDbUrl)('training: question bank import', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('creates the course, the topics in file order and the questions, all logged', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const s = slug();
			const report = await importQuizBank(tx, admin, file(s), { dry: false, ip: IP });
			expect(report).toMatchObject({
				courseCreated: true,
				topicsCreated: 2,
				questionsCreated: 3,
				questionsSkipped: 0
			});
			const got = await rows(tx, s);
			expect(got?.course).toMatchObject({ minAge: 18, requiredLevel: 'advanced' });
			expect(got?.topics.map((t) => t.title)).toEqual([
				{ ru: 'УТП 1-го года' },
				{ ru: 'Первая помощь' }
			]);
			expect(got?.questions).toHaveLength(3);
			expect(got?.questions.every((q) => q.createdBy === admin.id && q.correctIndex === 1)).toBe(
				true
			);
			const ids = [
				got!.course.id,
				...got!.topics.map((t) => t.id),
				...got!.questions.map((q) => q.id)
			];
			const audit = await tx.select().from(auditLog).where(eq(auditLog.actorId, admin.id));
			expect(
				audit
					.filter((e) => ids.includes(e.entityId ?? ''))
					.map((e) => e.action)
					.sort()
			).toEqual([
				'course.create',
				'course_topic.create',
				'course_topic.create',
				'quiz_question.create',
				'quiz_question.create',
				'quiz_question.create'
			]);
		});
	});

	it('a repeat adds nothing; an existing course keeps its settings and topics', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const s = slug();
			await importQuizBank(tx, admin, file(s), { dry: false, ip: IP });
			await tx.update(courses).set({ passCount: 20 }).where(eq(courses.slug, s));
			const again = await importQuizBank(tx, admin, file(s), { dry: false, ip: IP });
			expect(again).toMatchObject({
				courseCreated: false,
				topicsCreated: 0,
				questionsCreated: 0,
				questionsSkipped: 3
			});
			const got = await rows(tx, s);
			expect(got?.course.passCount).toBe(20);
			expect(got?.topics).toHaveLength(2);
			expect(got?.questions).toHaveLength(3);
		});
	});

	it('a topic made in the admin is matched by its title in any language', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const s = slug();
			const bankFile = file(s);
			const first = await importQuizBank(
				tx,
				admin,
				{ ...bankFile, topics: [] },
				{ dry: false, ip: IP }
			);
			if (typeof first === 'string') throw new Error(first);
			const title = { en: 'First aid', ru: 'Первая помощь' };
			await createTopic(tx, admin, first.courseId, { title }, IP);
			const report = await importQuizBank(tx, admin, bankFile, { dry: false, ip: IP });
			expect(report).toMatchObject({ topicsCreated: 1, questionsCreated: 3 });
			const got = await rows(tx, s);
			expect(got?.topics.map((t) => t.title)).toEqual([title, { ru: 'УТП 1-го года' }]);
		});
	});

	it('a dry run reports and writes nothing; only an admin imports', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const s = slug();
			const report = await importQuizBank(tx, admin, file(s), { dry: true, ip: IP });
			expect(report).toMatchObject({ courseCreated: true, topicsCreated: 2, questionsCreated: 3 });
			expect(await rows(tx, s)).toBeNull();
			const editor = await staff(tx, 'editor');
			expect(await importQuizBank(tx, editor, file(s), { dry: false, ip: IP })).toBe('not_allowed');
			expect(await rows(tx, s)).toBeNull();
		});
	});
});
