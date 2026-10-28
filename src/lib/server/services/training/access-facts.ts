import { and, eq, isNull } from 'drizzle-orm';
import { contactsSchema } from '#lib/validation/site-settings.ts';
import type { PortalText } from '#lib/i18n/localized.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { siteSettings } from '../../db/schema/service';
import { courses } from '../../db/schema/training';
import { users } from '../../db/schema/users';
import { getMembershipOverview } from '../memberships/overview';
import { missingConditions } from './access-rules';

/* Reads shared by the request and the decision (docs/03 section 18.1). */

export async function readCourse(tx: LimitDb, courseId: string) {
	const [row] = await tx
		.select({
			id: courses.id,
			slug: courses.slug,
			title: courses.title,
			status: courses.status,
			requiresMembership: courses.requiresMembership,
			minAge: courses.minAge,
			requiredLevel: courses.requiredLevel
		})
		.from(courses)
		.where(eq(courses.id, courseId));
	return row ? { ...row, title: row.title as PortalText } : null;
}
export type AccessCourseRow = NonNullable<Awaited<ReturnType<typeof readCourse>>>;

/** The member row locked: two requests of one member wait for each other. */
export async function lockMember(tx: LimitDb, userId: string) {
	const [row] = await tx
		.select({
			email: users.email,
			locale: users.locale,
			firstName: users.firstName,
			lastName: users.lastName,
			name: users.name,
			status: users.status,
			birthDate: users.birthDate,
			level: users.level
		})
		.from(users)
		.where(and(eq(users.id, userId), isNull(users.deletedAt)))
		.for('update');
	return row ?? null;
}
export type AccessMemberRow = NonNullable<Awaited<ReturnType<typeof lockMember>>>;

export async function missingFor(
	tx: LimitDb,
	course: AccessCourseRow,
	userId: string,
	member: AccessMemberRow,
	now: Date
) {
	const membership = course.requiresMembership
		? (await getMembershipOverview(tx, userId, now)).active
		: true;
	return missingConditions(course, member, membership, now);
}

/** `site_settings.contacts.email` (docs/03 section 18.5 p. 3); none or broken — `null`. */
export async function federationEmail(db: LimitDb): Promise<string | null> {
	const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, 'contacts'));
	const parsed = contactsSchema.safeParse(row?.value);
	return (parsed.success && parsed.data.email) || null;
}
