import { ageOn } from '#lib/validation/auth.ts';
import type { users } from '../../db/schema/users';

/* docs/03 section 18.1 p. 1; decisions — docs/todo.md 9.4 (1). */

type Level = (typeof users.$inferSelect)['level'];

export type AccessMissing = 'membership' | 'age' | 'level';

export type CourseConditions = {
	requiresMembership: boolean;
	minAge: number | null;
	requiredLevel: Level;
};

export type ApplicantFacts = { birthDate: string | null; level: Level };

const LEVEL_RANK: Record<NonNullable<Level>, number> = { novice: 1, advanced: 2, pro: 3 };
const rank = (level: Level) => (level ? LEVEL_RANK[level] : 0);

/** What the member lacks for the course, in a fixed order; empty — the conditions are met. */
export function missingConditions(
	course: CourseConditions,
	member: ApplicantFacts,
	membershipActive: boolean,
	now: Date
): AccessMissing[] {
	const missing: AccessMissing[] = [];
	if (course.requiresMembership && !membershipActive) missing.push('membership');
	if (course.minAge !== null) {
		const age = member.birthDate ? ageOn(member.birthDate, now) : null;
		if (age === null || age < course.minAge) missing.push('age');
	}
	if (course.requiredLevel && rank(member.level) < rank(course.requiredLevel)) {
		missing.push('level');
	}
	return missing;
}
