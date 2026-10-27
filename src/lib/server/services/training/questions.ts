import { isDeepStrictEqual } from 'node:util';
import { and, eq, sql } from 'drizzle-orm';
import type { QuestionValues } from '#lib/validation/training-questions.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { courses, quizQuestions } from '../../db/schema/training';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';
import { topicFits } from './lessons';

/* docs/05 section 27 "Question bank", docs/03 section 18.6; decisions — docs/todo.md 9.3 (5).
 * A question is never deleted: attempts keep a snapshot, statistics keep the `id`. */

type Refusal = 'not_allowed' | 'not_found' | 'bad_topic';
const LOGGED = ['topicId', 'text', 'options', 'correctIndex', 'source'] as const;

async function lockQuestion(tx: LimitDb, courseId: string, id: string) {
	if (!isUuid(courseId) || !isUuid(id)) return null;
	const [row] = await tx
		.select()
		.from(quizQuestions)
		.where(and(eq(quizQuestions.id, id), eq(quizQuestions.courseId, courseId)))
		.for('update');
	return row ?? null;
}

const entry = (actor: Actor, action: string, id: string, ip: string | null) => ({
	actorId: actor.id,
	action: `quiz_question.${action}`,
	entityType: 'quiz_question',
	entityId: id,
	ip
});

export async function createQuestion(
	db: LimitDb,
	actor: Actor,
	courseId: string,
	values: QuestionValues,
	ip: string | null
): Promise<{ id: string } | Refusal> {
	if (!roleCan(actor.role, 'training.manage')) return 'not_allowed';
	if (!isUuid(courseId)) return 'not_found';
	return db.transaction(async (tx) => {
		const [course] = await tx
			.select({ id: courses.id })
			.from(courses)
			.where(eq(courses.id, courseId));
		if (!course) return 'not_found' as const;
		if (!(await topicFits(tx, courseId, values.topicId))) return 'bad_topic' as const;
		const [row] = await tx
			.insert(quizQuestions)
			/* clock_timestamp: an import in one transaction still keeps its order. */
			.values({ ...values, courseId, createdBy: actor.id, createdAt: sql`clock_timestamp()` })
			.returning({ id: quizQuestions.id });
		await writeAudit(tx, { ...entry(actor, 'create', row.id, ip), after: { courseId, ...values } });
		return { id: row.id };
	});
}

export async function updateQuestion(
	db: LimitDb,
	actor: Actor,
	courseId: string,
	id: string,
	values: QuestionValues,
	ip: string | null
): Promise<'ok' | Refusal> {
	if (!roleCan(actor.role, 'training.manage')) return 'not_allowed';
	return db.transaction(async (tx) => {
		const question = await lockQuestion(tx, courseId, id);
		if (!question) return 'not_found' as const;
		if (!(await topicFits(tx, courseId, values.topicId))) return 'bad_topic' as const;
		const before: Record<string, unknown> = {};
		const after: Record<string, unknown> = {};
		for (const key of LOGGED) {
			if (isDeepStrictEqual(question[key], values[key])) continue;
			before[key] = question[key];
			after[key] = values[key];
		}
		if (Object.keys(after).length === 0) return 'ok' as const;
		await tx.update(quizQuestions).set(values).where(eq(quizQuestions.id, question.id));
		await writeAudit(tx, { ...entry(actor, 'update', question.id, ip), before, after });
		return 'ok' as const;
	});
}

export async function setQuestionHidden(
	db: LimitDb,
	actor: Actor,
	courseId: string,
	id: string,
	hidden: boolean,
	ip: string | null
): Promise<'ok' | 'bad_state' | Exclude<Refusal, 'bad_topic'>> {
	if (!roleCan(actor.role, 'training.manage')) return 'not_allowed';
	return db.transaction(async (tx) => {
		const question = await lockQuestion(tx, courseId, id);
		if (!question) return 'not_found' as const;
		if ((question.hiddenAt !== null) === hidden) return 'bad_state' as const;
		await tx
			.update(quizQuestions)
			.set({ hiddenAt: hidden ? new Date() : null })
			.where(eq(quizQuestions.id, question.id));
		await writeAudit(tx, entry(actor, hidden ? 'hide' : 'restore', question.id, ip));
		return 'ok' as const;
	});
}
