import { isDeepStrictEqual } from 'node:util';
import { and, eq } from 'drizzle-orm';
import type { TaskValues } from '#lib/validation/training-practice.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { courses } from '../../db/schema/training';
import { practiceTasks } from '../../db/schema/training-progress';
import type { Mail } from '../../mail/resend';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';

/* docs/05 section 27 "Practice tasks" (admin); decisions — docs/todo.md 9.7 (1). Never deleted. */

type Refusal = 'not_allowed' | 'not_found';

async function lockTask(tx: LimitDb, courseId: string, taskId: string) {
	if (!isUuid(courseId) || !isUuid(taskId)) return null;
	const [row] = await tx
		.select()
		.from(practiceTasks)
		.where(and(eq(practiceTasks.id, taskId), eq(practiceTasks.courseId, courseId)))
		.for('update');
	return row ?? null;
}

const entry = (actor: Actor, action: string, id: string, ip: string | null) => ({
	actorId: actor.id,
	action: `practice_task.${action}`,
	entityType: 'practice_task',
	entityId: id,
	ip
});

export async function createTask(
	db: LimitDb,
	actor: Actor,
	courseId: string,
	values: TaskValues,
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
		const [row] = await tx
			.insert(practiceTasks)
			.values({ ...values, courseId })
			.returning({ id: practiceTasks.id });
		const { title, sortOrder } = values;
		await writeAudit(tx, {
			...entry(actor, 'create', row.id, ip),
			after: { courseId, title, sortOrder }
		});
		return { id: row.id };
	});
}

export async function updateTask(
	db: LimitDb,
	actor: Actor,
	courseId: string,
	taskId: string,
	values: TaskValues,
	ip: string | null
): Promise<'ok' | Refusal> {
	if (!roleCan(actor.role, 'training.manage')) return 'not_allowed';
	return db.transaction(async (tx) => {
		const task = await lockTask(tx, courseId, taskId);
		if (!task) return 'not_found' as const;
		const before: Record<string, unknown> = {};
		const after: Record<string, unknown> = {};
		for (const key of ['title', 'sortOrder'] as const) {
			if (isDeepStrictEqual(task[key], values[key])) continue;
			before[key] = task[key];
			after[key] = values[key];
		}
		const descriptionChanged = !isDeepStrictEqual(task.description ?? {}, values.description);
		if (!descriptionChanged && Object.keys(after).length === 0) return 'ok' as const;
		await tx.update(practiceTasks).set(values).where(eq(practiceTasks.id, task.id));
		await writeAudit(tx, {
			...entry(actor, 'update', task.id, ip),
			before,
			after: descriptionChanged ? { ...after, descriptionChanged: true } : after
		});
		return 'ok' as const;
	});
}

export type HideDeps = {
	send: (mail: Mail) => Promise<void>;
	siteUrl: string | undefined;
	ip: string | null;
	now?: Date;
};

export async function setTaskHidden(
	db: LimitDb,
	actor: Actor,
	courseId: string,
	taskId: string,
	hidden: boolean,
	deps: HideDeps
): Promise<'ok' | 'bad_state' | Refusal> {
	if (!roleCan(actor.role, 'training.manage')) return 'not_allowed';
	const { ip } = deps;
	return db.transaction(async (tx) => {
		const task = await lockTask(tx, courseId, taskId);
		if (!task) return 'not_found' as const;
		if ((task.hiddenAt !== null) === hidden) return 'bad_state' as const;
		await tx
			.update(practiceTasks)
			.set({ hiddenAt: hidden ? new Date() : null })
			.where(eq(practiceTasks.id, task.id));
		await writeAudit(tx, entry(actor, hidden ? 'hide' : 'restore', task.id, ip));
		return 'ok' as const;
	});
}
