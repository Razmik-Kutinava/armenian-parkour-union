import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { courseContentSchema } from '#lib/validation/training-content.ts';
import type { LimitDb } from '../../auth/rate-limit';
import type { UserRole } from '../../auth/session';
import { auditLog } from '../../db/schema/service';
import { courseLessons, quizQuestions } from '../../db/schema/training';
import { testDb, testDbUrl } from '../../db/test-db';
import { fakeStorage } from '../media/fake-storage';
import type { Actor } from '../users/target';
import { decideAccess } from './access-decision';
import { importCourseContent } from './content-import';
import { createCourse, updateCourse } from './courses';
import { completeLessonPdf, removeLessonPdf, signLessonPdf } from './lesson-files';
import { createLesson, deleteLesson, updateLesson } from './lessons';
import { openPortal } from './portal-gate';
import { reviewPractice } from './practice-review';
import { createTask, setTaskHidden, updateTask } from './practice-tasks';
import { insertSubmission, insertTask, practiceCourse } from './practice-test-support';
import { createQuestion, setQuestionHidden, updateQuestion } from './questions';
import { grantExtraAttempt } from './quiz-extra';
import { quizCourse } from './quiz-test-support';
import {
	accessDeps,
	applied,
	courseValues,
	insertOpenCourse,
	insertTopic,
	IP,
	lessonValues,
	mailbox,
	PDF,
	questionValues,
	SITE,
	staff
} from './test-support';
import { createTopic, moveTopic, setTopicHidden, updateTopic } from './topics';

/* docs/04 section "training.*": every write of the portal admin checks the permission on the
 * server; a role outside the table is refused and nothing is written. The table is docs/04, not
 * permissions.ts. Roadmap 9.10. */

const ROLES: UserRole[] = ['member', 'editor', 'moderator', 'admin'];
const DOC04 = {
	'training.lessons': ['editor', 'admin'],
	'training.manage': ['admin'],
	'training.review': ['moderator', 'admin']
} as const satisfies Record<string, readonly UserRole[]>;

async function fixture(tx: LimitDb) {
	const admin = await staff(tx);
	const course = await insertOpenCourse(tx);
	const draft = await insertOpenCourse(tx, { status: 'draft' });
	const topicId = await insertTopic(tx, course.id);
	const [lesson] = await tx
		.insert(courseLessons)
		.values({ courseId: course.id, title: { en: 'Lesson' } })
		.returning({ id: courseLessons.id });
	const [question] = await tx
		.insert(quizQuestions)
		.values({ ...questionValues(topicId), courseId: course.id })
		.returning({ id: quizQuestions.id });
	const taskId = await insertTask(tx, course.id);
	const pending = await applied(tx);
	const quiz = await quizCourse(tx);
	const practice = await practiceCourse(tx);
	const submission = await insertSubmission(tx, practice.tasks[0], practice.member.id);
	return {
		admin,
		course,
		draft,
		topicId,
		lessonId: lesson.id,
		questionId: question.id,
		taskId,
		requestId: pending.id,
		extraFor: quiz.accessId,
		submission,
		storage: fakeStorage()
	};
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
type Action = (tx: LimitDb, actor: Actor, f: Fixture) => Promise<unknown>;

const task = { title: { en: 'Roll' }, description: { ru: '<p>Перекат</p>' }, sortOrder: 0 };
const content = courseContentSchema(null).parse({
	topics: [
		{ title: { ru: 'Тема' }, lessons: [{ title: { ru: 'Урок' }, body: { ru: '<p>Т</p>' } }] }
	],
	practiceTasks: []
});
const pdf = { mime: 'application/pdf' as const, size: PDF.length };

const ACTIONS: Record<keyof typeof DOC04, Record<string, Action>> = {
	'training.lessons': {
		createLesson: (tx, a, f) => createLesson(tx, a, f.course.id, lessonValues(), IP),
		updateLesson: (tx, a, f) => updateLesson(tx, a, f.course.id, f.lessonId, lessonValues(), IP),
		signLessonPdf: (tx, a, f) => signLessonPdf(tx, f.storage, a, f.course.id, f.lessonId, pdf),
		completeLessonPdf: (tx, a, f) =>
			completeLessonPdf(
				tx,
				f.storage,
				a,
				f.course.id,
				f.lessonId,
				{ key: `training/${f.course.id}/${crypto.randomUUID()}.pdf`, name: 'a.pdf' },
				IP
			),
		removeLessonPdf: (tx, a, f) => removeLessonPdf(tx, f.storage, a, f.course.id, f.lessonId, IP),
		deleteLesson: (tx, a, f) => deleteLesson(tx, a, f.course.id, f.lessonId, IP)
	},
	'training.manage': {
		createCourse: (tx, a) => createCourse(tx, a, courseValues(), IP),
		updateCourse: (tx, a, f) =>
			updateCourse(tx, a, f.draft.id, courseValues({ slug: f.draft.slug }), IP),
		createTopic: (tx, a, f) => createTopic(tx, a, f.course.id, { title: { en: 'X' } }, IP),
		updateTopic: (tx, a, f) =>
			updateTopic(tx, a, f.course.id, f.topicId, { title: { en: 'Y' } }, IP),
		moveTopic: (tx, a, f) => moveTopic(tx, a, f.course.id, f.topicId, 'down', IP),
		hideTopic: (tx, a, f) => setTopicHidden(tx, a, f.course.id, f.topicId, true, IP),
		createQuestion: (tx, a, f) => createQuestion(tx, a, f.course.id, questionValues(f.topicId), IP),
		updateQuestion: (tx, a, f) =>
			updateQuestion(tx, a, f.course.id, f.questionId, questionValues(f.topicId), IP),
		hideQuestion: (tx, a, f) => setQuestionHidden(tx, a, f.course.id, f.questionId, true, IP),
		createTask: (tx, a, f) => createTask(tx, a, f.course.id, task, IP),
		updateTask: (tx, a, f) => updateTask(tx, a, f.course.id, f.taskId, task, IP),
		hideTask: (tx, a, f) => setTaskHidden(tx, a, f.course.id, f.taskId, true, IP),
		importContent: (tx, a, f) =>
			importCourseContent(tx, a, f.course.slug, content, { dry: true, ip: IP }),
		decideAccess: (tx, a, f) =>
			decideAccess(tx, a, f.requestId, { action: 'approve' }, accessDeps(mailbox().send)),
		grantExtraAttempt: (tx, a, f) => grantExtraAttempt(tx, a, f.extraFor, { ip: IP })
	},
	'training.review': {
		reviewPractice: (tx, a, f) =>
			reviewPractice(
				tx,
				a,
				f.submission,
				{ action: 'approve', comment: '' },
				{ send: mailbox().send, siteUrl: SITE, ip: IP }
			)
	}
};

const refused = (result: unknown) =>
	result === 'not_allowed' || (result as { reason?: unknown })?.reason === 'not_allowed';
const auditBy = (tx: LimitDb, actorId: string) =>
	tx.select().from(auditLog).where(eq(auditLog.actorId, actorId));

describe.skipIf(!testDbUrl)('training: rights by the table of docs/04', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	for (const [permission, actions] of Object.entries(ACTIONS) as [
		keyof typeof DOC04,
		Record<string, Action>
	][]) {
		const allowed: readonly UserRole[] = DOC04[permission];
		it(`${permission}: only ${allowed.join(', ')}; the others are refused and write nothing`, async () => {
			await inRollback(async (tx) => {
				const f = await fixture(tx);
				for (const role of ROLES) {
					const actor = (await staff(tx, role)) as Actor;
					for (const [name, action] of Object.entries(actions)) {
						const result = await action(tx, actor, f);
						expect(refused(result), `${role} ${name}: ${JSON.stringify(result)}`).toBe(
							!allowed.includes(role)
						);
					}
					if (!allowed.includes(role)) expect(await auditBy(tx, actor.id)).toEqual([]);
				}
			});
		}, 60_000);
	}

	it('portal preview without a request: only training.manage', async () => {
		await inRollback(async (tx) => {
			const f = await fixture(tx);
			for (const role of ROLES) {
				const actor = (await staff(tx, role)) as Actor;
				const gate = await openPortal(tx, actor, f.draft.slug);
				expect(gate?.preview ?? null, role).toBe(
					(DOC04['training.manage'] as readonly UserRole[]).includes(role) ? true : null
				);
			}
		});
	});
});
