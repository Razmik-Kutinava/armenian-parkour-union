import { and, asc, eq, isNull } from 'drizzle-orm';
import type { PortalText } from '#lib/i18n/localized.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { courses } from '../../db/schema/training';
import { courseAccess } from '../../db/schema/training-progress';
import { users } from '../../db/schema/users';
import { getMembershipOverview } from '../memberships/overview';
import { isUuid } from '../users/target';
import { missingConditions, type AccessMissing } from './access-rules';

/* docs/06 section 5.11 "Course list": the member's own requests only (the id comes from the
 * session); decisions — docs/todo.md 9.4 (6). */

export type CabinetCourseState =
	'finished' | 'approved' | 'pending' | 'revoked' | 'rejected' | 'can_apply' | 'missing';

export type CabinetCourse = {
	id: string;
	slug: string;
	title: PortalText;
	description: PortalText;
	minAge: number | null;
	requiredLevel: (typeof courses.$inferSelect)['requiredLevel'];
	state: CabinetCourseState;
	missing: AccessMissing[];
	reviewNote: string | null;
	canApply: boolean;
};

function stateOf(
	access: { status: string; examId: string | null } | undefined,
	missing: AccessMissing[]
): CabinetCourseState {
	if (access?.examId) return 'finished';
	if (access) return access.status as CabinetCourseState;
	return missing.length > 0 ? 'missing' : 'can_apply';
}

export async function cabinetCourses(
	db: LimitDb,
	userId: string,
	now = new Date()
): Promise<CabinetCourse[]> {
	if (!isUuid(userId)) return [];
	const [[member], list, own, membership] = await Promise.all([
		db
			.select({ birthDate: users.birthDate, level: users.level })
			.from(users)
			.where(and(eq(users.id, userId), isNull(users.deletedAt))),
		db
			.select()
			.from(courses)
			.where(eq(courses.status, 'published'))
			.orderBy(asc(courses.createdAt)),
		db.select().from(courseAccess).where(eq(courseAccess.userId, userId)),
		getMembershipOverview(db, userId, now)
	]);
	if (!member) return [];
	return list.map((course) => {
		const access = own.find((a) => a.courseId === course.id);
		const missing = missingConditions(course, member, membership.active, now);
		const state = stateOf(access, missing);
		return {
			id: course.id,
			slug: course.slug,
			title: course.title as PortalText,
			description: course.description as PortalText,
			minAge: course.minAge,
			requiredLevel: course.requiredLevel,
			state,
			missing,
			reviewNote: access?.reviewNote ?? null,
			canApply: (state === 'can_apply' || state === 'rejected') && missing.length === 0
		};
	});
}
