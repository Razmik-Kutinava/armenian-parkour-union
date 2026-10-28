import { and, eq, isNull } from 'drizzle-orm';
import type { CourseContent } from '#lib/validation/training-content.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { courseLessons, courses } from '../../db/schema/training';
import { practiceTasks } from '../../db/schema/training-progress';
import type { Actor } from '../users/target';
import { createLesson } from './lessons';
import { createTask } from './practice-tasks';
import { createTopic, listTopics } from './topics';

/* Import of the prepared course content (roadmap 9.9; docs/todo.md 9.9, decisions 1–4): lessons and
 * practice tasks go through the admin services, so the audit log gets every row. One transaction. */

export type ContentReport = {
	courseId: string;
	topicsCreated: number;
	lessonsCreated: number;
	lessonsSkipped: number;
	tasksCreated: number;
	tasksSkipped: number;
};

class DryRun extends Error {
	constructor(readonly report: ContentReport) {
		super('dry run');
	}
}

function expectCreated<T>(result: T | string, what: string): T {
	if (typeof result === 'string') throw new Error(`${what}: ${result}`);
	return result;
}

const valuesOf = (title: unknown) => Object.values(title as object) as string[];
/** Titles in any language: a title translated later in the admin still matches. */
const titleSet = (rows: { title: unknown }[]) => new Set(rows.flatMap((r) => valuesOf(r.title)));
const known = (titles: Set<string>, title: unknown) => valuesOf(title).some((t) => titles.has(t));

async function topicIds(tx: LimitDb, courseId: string) {
	const byTitle = new Map<string, string>();
	for (const topic of await listTopics(tx, courseId)) {
		for (const title of valuesOf(topic.title)) byTitle.set(title, topic.id);
	}
	return byTitle;
}

async function run(
	tx: LimitDb,
	actor: Actor,
	courseId: string,
	content: CourseContent,
	ip: string | null
) {
	const report: ContentReport = {
		courseId,
		topicsCreated: 0,
		lessonsCreated: 0,
		lessonsSkipped: 0,
		tasksCreated: 0,
		tasksSkipped: 0
	};
	const byTitle = await topicIds(tx, courseId);
	const lessonTitles = titleSet(
		await tx
			.select({ title: courseLessons.title })
			.from(courseLessons)
			.where(and(eq(courseLessons.courseId, courseId), isNull(courseLessons.deletedAt)))
	);
	for (const topic of content.topics) {
		let topicId = valuesOf(topic.title)
			.map((title) => byTitle.get(title))
			.find(Boolean);
		if (!topicId) {
			const values = { title: topic.title };
			topicId = expectCreated(await createTopic(tx, actor, courseId, values, ip), 'topic').id;
			report.topicsCreated++;
		}
		for (const [sortOrder, lesson] of topic.lessons.entries()) {
			if (known(lessonTitles, lesson.title)) {
				report.lessonsSkipped++;
				continue;
			}
			const values = { ...lesson, topicId, sortOrder, status: 'draft' as const };
			expectCreated(await createLesson(tx, actor, courseId, values, ip), 'lesson');
			for (const title of valuesOf(lesson.title)) lessonTitles.add(title);
			report.lessonsCreated++;
		}
	}
	const taskTitles = titleSet(
		await tx
			.select({ title: practiceTasks.title })
			.from(practiceTasks)
			.where(eq(practiceTasks.courseId, courseId))
	);
	for (const [sortOrder, task] of content.practiceTasks.entries()) {
		if (known(taskTitles, task.title)) {
			report.tasksSkipped++;
			continue;
		}
		expectCreated(await createTask(tx, actor, courseId, { ...task, sortOrder }, ip), 'task');
		for (const title of valuesOf(task.title)) taskTitles.add(title);
		report.tasksCreated++;
	}
	return report;
}

/** Into an existing course (its settings come from the bank import): lessons as drafts, tasks
 * visible (the draft course hides them); a lesson or a task with a known title is skipped. */
export async function importCourseContent(
	db: LimitDb,
	actor: Actor,
	slug: string,
	content: CourseContent,
	options: { dry: boolean; ip: string | null }
): Promise<ContentReport | 'not_allowed' | 'not_found'> {
	if (!roleCan(actor.role, 'training.manage')) return 'not_allowed';
	try {
		return await db.transaction(async (tx) => {
			const [course] = await tx
				.select({ id: courses.id })
				.from(courses)
				.where(eq(courses.slug, slug));
			if (!course) return 'not_found' as const;
			const report = await run(tx, actor, course.id, content, options.ip);
			if (options.dry) throw new DryRun(report);
			return report;
		});
	} catch (e) {
		if (e instanceof DryRun) return e.report;
		throw e;
	}
}
