import { and, eq, isNull } from 'drizzle-orm';
import type { PortalText } from '#lib/i18n/localized.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { courses } from '../../db/schema/training';
import { courseAccess } from '../../db/schema/training-progress';
import { users } from '../../db/schema/users';
import type { Actor } from '../users/target';

/* docs/03 section 18.1 p. 4–5: open only with an approved request of an active member; staff with
 * `training.manage` preview it without one. Decisions — docs/todo.md 9.5 (1). */

export type PortalCourse = { id: string; slug: string; title: PortalText; description: PortalText };
export type PortalGate = { course: PortalCourse; preview: boolean };

async function approved(db: LimitDb, courseId: string, userId: string) {
	const [row] = await db
		.select({ id: courseAccess.id })
		.from(courseAccess)
		.innerJoin(users, eq(users.id, courseAccess.userId))
		.where(
			and(
				eq(courseAccess.courseId, courseId),
				eq(courseAccess.userId, userId),
				eq(courseAccess.status, 'approved'),
				eq(users.status, 'active'),
				isNull(users.deletedAt)
			)
		);
	return Boolean(row);
}

/** `null` — no such course or no access: the page answers 404 either way. */
export async function openPortal(
	db: LimitDb,
	viewer: Actor,
	slug: string
): Promise<PortalGate | null> {
	const [row] = await db.select().from(courses).where(eq(courses.slug, slug));
	if (!row) return null;
	const course: PortalCourse = {
		id: row.id,
		slug: row.slug,
		title: row.title as PortalText,
		description: row.description as PortalText
	};
	if (row.status === 'published' && (await approved(db, row.id, viewer.id))) {
		return { course, preview: false };
	}
	return roleCan(viewer.role, 'training.manage') ? { course, preview: true } : null;
}
