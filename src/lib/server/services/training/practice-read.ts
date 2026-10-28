import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { PortalText } from '#lib/i18n/localized.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { practiceSubmissions, practiceTasks } from '../../db/schema/training-progress';
import type { Actor } from '../users/target';
import { openPortal, type PortalGate } from './portal-gate';
import { quizPassed } from './practice-facts';
import { taskOrder } from './practice-task-list';
import { accessOf } from './quiz-facts';

/* docs/06 section 5.11 "Practice" and the portal block: visible tasks with the state of each, the
 * history, accepted N of M. Decisions — docs/todo.md 9.7 (5). */

export type PracticeState = 'open' | 'quiz' | 'finished' | 'preview';
export type PracticeSubmissionView = {
	id: string;
	url: string;
	platform: 'youtube' | 'google_drive';
	status: 'pending' | 'approved' | 'rejected';
	note: string | null;
	createdAt: Date;
};
export type PracticeTaskView = {
	id: string;
	title: PortalText;
	/** Sanitized HTML (richTextSchema), shown as is. */
	description: PortalText;
	/** The live one (pending or approved), else the latest returned. */
	current: PracticeSubmissionView | null;
	/** Newest first, the current one included. */
	history: PracticeSubmissionView[];
};
export type PracticeStatus = {
	state: PracticeState;
	tasks: PracticeTaskView[];
	accepted: number;
	total: number;
};

async function stateOf(db: LimitDb, gate: PortalGate, userId: string): Promise<PracticeState> {
	if (gate.preview) return 'preview';
	const access = await accessOf(db, gate.course.id, userId);
	if (access?.examId) return 'finished';
	return (await quizPassed(db, gate.course.id, userId)) ? 'open' : 'quiz';
}

export async function practiceStatus(
	db: LimitDb,
	gate: PortalGate,
	userId: string
): Promise<PracticeStatus> {
	const tasks = await db
		.select({
			id: practiceTasks.id,
			title: practiceTasks.title,
			description: practiceTasks.description
		})
		.from(practiceTasks)
		.where(and(eq(practiceTasks.courseId, gate.course.id), isNull(practiceTasks.hiddenAt)))
		.orderBy(...taskOrder);
	const ids = tasks.map((t) => t.id);
	const rows =
		gate.preview || ids.length === 0
			? []
			: await db
					.select({
						id: practiceSubmissions.id,
						taskId: practiceSubmissions.taskId,
						url: practiceSubmissions.url,
						platform: practiceSubmissions.platform,
						status: practiceSubmissions.status,
						note: practiceSubmissions.reviewNote,
						createdAt: practiceSubmissions.createdAt
					})
					.from(practiceSubmissions)
					.where(
						and(eq(practiceSubmissions.userId, userId), inArray(practiceSubmissions.taskId, ids))
					)
					.orderBy(desc(practiceSubmissions.createdAt), desc(practiceSubmissions.id));
	const views = tasks.map((task): PracticeTaskView => {
		const history = rows
			.filter((r) => r.taskId === task.id)
			.map((r) => ({
				id: r.id,
				url: r.url,
				platform: r.platform,
				status: r.status,
				note: r.note,
				createdAt: r.createdAt
			}));
		const live = history.find((r) => r.status !== 'rejected');
		return {
			id: task.id,
			title: task.title as PortalText,
			description: task.description as PortalText,
			current: live ?? history[0] ?? null,
			history
		};
	});
	return {
		state: await stateOf(db, gate, userId),
		tasks: views,
		accepted: views.filter((t) => t.current?.status === 'approved').length,
		total: views.length
	};
}

/** `null` — no such course or no access: the page answers 404. */
export async function practicePage(db: LimitDb, viewer: Actor, slug: string) {
	const gate = await openPortal(db, viewer, slug);
	if (!gate) return null;
	return { ...gate, ...(await practiceStatus(db, gate, viewer.id)) };
}
