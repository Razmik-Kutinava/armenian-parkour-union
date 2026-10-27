import { isDeepStrictEqual } from 'node:util';
import { and, eq, ne } from 'drizzle-orm';
import type { CourseValues } from '#lib/validation/training.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { courses } from '../../db/schema/training';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';
import { getCourse } from './course-list';

/* docs/05 section 27, docs/03 section 18.6: a settings change is logged; running attempts keep
 * their own pass count (a snapshot in `quiz_attempts`). */

type Refusal = 'not_allowed' | 'not_found' | 'slug_taken';

async function slugTaken(tx: LimitDb, slug: string, exceptId?: string) {
	const [row] = await tx
		.select({ id: courses.id })
		.from(courses)
		.where(
			exceptId ? and(eq(courses.slug, slug), ne(courses.id, exceptId)) : eq(courses.slug, slug)
		);
	return !!row;
}

export async function createCourse(
	db: LimitDb,
	actor: Actor,
	values: CourseValues,
	ip: string | null
): Promise<{ id: string } | Exclude<Refusal, 'not_found'>> {
	if (!roleCan(actor.role, 'training.manage')) return 'not_allowed';
	return db.transaction(async (tx) => {
		if (await slugTaken(tx, values.slug)) return 'slug_taken' as const;
		const [row] = await tx.insert(courses).values(values).returning({ id: courses.id });
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'course.create',
			entityType: 'course',
			entityId: row.id,
			after: { ...values, description: undefined },
			ip
		});
		return { id: row.id };
	});
}

export async function updateCourse(
	db: LimitDb,
	actor: Actor,
	id: string,
	values: CourseValues,
	ip: string | null
): Promise<'ok' | Refusal> {
	if (!roleCan(actor.role, 'training.manage')) return 'not_allowed';
	if (!isUuid(id)) return 'not_found';
	return db.transaction(async (tx) => {
		const [locked] = await tx
			.select({ id: courses.id })
			.from(courses)
			.where(eq(courses.id, id))
			.for('update');
		const course = locked && (await getCourse(tx, id));
		if (!course) return 'not_found' as const;
		if (values.slug !== course.slug && (await slugTaken(tx, values.slug, id))) {
			return 'slug_taken' as const;
		}
		const before: Record<string, unknown> = {};
		const after: Record<string, unknown> = {};
		for (const key of Object.keys(values) as (keyof CourseValues)[]) {
			if (isDeepStrictEqual(course[key], values[key])) continue;
			before[key] = course[key];
			after[key] = values[key];
		}
		if (Object.keys(after).length === 0) return 'ok' as const;
		await tx.update(courses).set(values).where(eq(courses.id, id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'course.update',
			entityType: 'course',
			entityId: id,
			before,
			after,
			ip
		});
		return 'ok' as const;
	});
}
