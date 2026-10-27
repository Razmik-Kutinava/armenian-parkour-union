import { isDeepStrictEqual } from 'node:util';
import { eq } from 'drizzle-orm';
import type { QuizBankFile } from '#lib/validation/training-questions.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { courses, quizQuestions } from '../../db/schema/training';
import type { Actor } from '../users/target';
import { createCourse } from './courses';
import { createQuestion } from './questions';
import { createTopic, listTopics } from './topics';

/* Import of the prepared bank file (roadmap 9.3; docs/todo.md 9.3, decision 7): everything goes
 * through the admin services, so the audit log gets every row. One transaction — all or nothing. */

export type ImportReport = {
	courseId: string;
	courseCreated: boolean;
	topicsCreated: number;
	questionsCreated: number;
	questionsSkipped: number;
};

class DryRun extends Error {
	constructor(readonly report: ImportReport) {
		super('dry run');
	}
}

function expectCreated<T>(result: T | string, what: string): T {
	if (typeof result === 'string') throw new Error(`${what}: ${result}`);
	return result;
}

async function courseOf(tx: LimitDb, actor: Actor, bank: QuizBankFile, ip: string | null) {
	const [row] = await tx
		.select({ id: courses.id })
		.from(courses)
		.where(eq(courses.slug, bank.course.slug));
	if (row) return { id: row.id, created: false };
	const made = expectCreated(await createCourse(tx, actor, bank.course, ip), 'course');
	return { id: made.id, created: true };
}

async function run(tx: LimitDb, actor: Actor, bank: QuizBankFile, ip: string | null) {
	const course = await courseOf(tx, actor, bank, ip);
	const report: ImportReport = {
		courseId: course.id,
		courseCreated: course.created,
		topicsCreated: 0,
		questionsCreated: 0,
		questionsSkipped: 0
	};
	const topicByTitle = new Map<string, string>();
	for (const topic of await listTopics(tx, course.id)) {
		for (const title of Object.values(topic.title as object)) topicByTitle.set(title, topic.id);
	}
	const texts = (
		await tx
			.select({ text: quizQuestions.text })
			.from(quizQuestions)
			.where(eq(quizQuestions.courseId, course.id))
	).map((q) => q.text);
	for (const topic of bank.topics) {
		let topicId = Object.values(topic.title)
			.map((title) => topicByTitle.get(title))
			.find(Boolean);
		if (!topicId) {
			const values = { title: topic.title };
			topicId = expectCreated(await createTopic(tx, actor, course.id, values, ip), 'topic').id;
			report.topicsCreated++;
		}
		for (const question of topic.questions) {
			if (texts.some((text) => isDeepStrictEqual(text, question.text))) {
				report.questionsSkipped++;
				continue;
			}
			const values = { ...question, topicId };
			expectCreated(await createQuestion(tx, actor, course.id, values, ip), 'question');
			texts.push(question.text);
			report.questionsCreated++;
		}
	}
	return report;
}

/** A course that exists keeps its settings; topics match by a title in any language; a question
 * with the same text is skipped, so a repeat adds only new ones. `dry` rolls everything back. */
export async function importQuizBank(
	db: LimitDb,
	actor: Actor,
	bank: QuizBankFile,
	options: { dry: boolean; ip: string | null }
): Promise<ImportReport | 'not_allowed'> {
	if (!roleCan(actor.role, 'training.manage')) return 'not_allowed';
	try {
		return await db.transaction(async (tx) => {
			const report = await run(tx, actor, bank, options.ip);
			if (options.dry) throw new DryRun(report);
			return report;
		});
	} catch (e) {
		if (e instanceof DryRun) return e.report;
		throw e;
	}
}
