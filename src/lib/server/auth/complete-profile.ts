import { and, eq, isNull } from 'drizzle-orm';
import type { Locale } from '#lib/i18n/locales.ts';
import { isMinor } from '#lib/validation/auth.ts';
import type { ProfileCompletion } from '#lib/validation/profile.ts';
import { users } from '../db/schema/users';
import type { LimitDb } from './rate-limit';

/** Names Google gave, to prefill the form. */
export async function profileDraft(db: LimitDb, userId: string) {
	const [row] = await db
		.select({ firstName: users.firstName, lastName: users.lastName })
		.from(users)
		.where(eq(users.id, userId));
	return { firstName: row?.firstName ?? '', lastName: row?.lastName ?? '' };
}

/**
 * Saves the form once: a profile with consent already given is never overwritten (false).
 * Parent data is stored only for minors (docs/03 section 13).
 */
export async function completeProfile(
	db: LimitDb,
	userId: string,
	data: ProfileCompletion,
	locale: Locale,
	today: Date = new Date()
): Promise<boolean> {
	const minor = isMinor(data.birthDate, today);
	const rows = await db
		.update(users)
		.set({
			firstName: data.firstName,
			lastName: data.lastName,
			name: `${data.firstName} ${data.lastName}`,
			birthDate: data.birthDate,
			guardianName: minor ? data.guardianName : null,
			guardianPhone: minor ? data.guardianPhone : null,
			guardianEmail: minor ? data.guardianEmail : null,
			locale,
			termsAcceptedAt: new Date()
		})
		.where(and(eq(users.id, userId), isNull(users.termsAcceptedAt)))
		.returning({ id: users.id });
	return rows.length > 0;
}
