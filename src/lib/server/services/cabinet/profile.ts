import { and, eq, isNull } from 'drizzle-orm';
import { isMinor } from '#lib/validation/auth.ts';
import type { OwnProfileInput } from '#lib/validation/cabinet.ts';
import { hasPassword } from '../../auth/credential';
import type { LimitDb } from '../../auth/rate-limit';
import { users } from '../../db/schema/users';
import { isUuid } from '../users/target';

export type OwnProfile = {
	email: string;
	firstName: string | null;
	lastName: string | null;
	birthDate: string | null;
	phone: string | null;
	country: string | null;
	city: string | null;
	bio: string | null;
	avatarKey: string | null;
	locale: string;
	guardianName: string | null;
	guardianPhone: string | null;
	guardianEmail: string | null;
	/** Under 18 by the stored birth date: parent data is required (docs/03 section 13). */
	minor: boolean;
	/** A Google-only account has none: the form offers to set one by mail. */
	hasPassword: boolean;
};

const own = (userId: string) => and(eq(users.id, userId), isNull(users.deletedAt));

/** docs/06 section 5.2: the profile of the signed-in member only (docs/04 section 5.3). */
export async function getOwnProfile(
	db: LimitDb,
	userId: string,
	today = new Date()
): Promise<OwnProfile | null> {
	if (!isUuid(userId)) return null;
	const [row] = await db
		.select({
			email: users.email,
			firstName: users.firstName,
			lastName: users.lastName,
			birthDate: users.birthDate,
			phone: users.phone,
			country: users.country,
			city: users.city,
			bio: users.bio,
			avatarKey: users.avatarKey,
			locale: users.locale,
			guardianName: users.guardianName,
			guardianPhone: users.guardianPhone,
			guardianEmail: users.guardianEmail
		})
		.from(users)
		.where(own(userId));
	if (!row) return null;
	const minor = row.birthDate ? isMinor(row.birthDate, today) : false;
	return { ...row, minor, hasPassword: await hasPassword(db, userId) };
}

/** Birth date is not changed here; parent data is kept only for a minor, otherwise cleared. */
export async function updateOwnProfile(
	db: LimitDb,
	userId: string,
	data: OwnProfileInput,
	today = new Date()
): Promise<'ok' | 'not_found' | 'guardian_required'> {
	if (!isUuid(userId)) return 'not_found';
	return db.transaction(async (tx) => {
		const [current] = await tx
			.select({ birthDate: users.birthDate })
			.from(users)
			.where(own(userId))
			.for('update');
		if (!current) return 'not_found';
		const minor = current.birthDate ? isMinor(current.birthDate, today) : false;
		if (minor && (!data.guardianName || !data.guardianPhone || !data.guardianEmail)) {
			return 'guardian_required';
		}
		await tx
			.update(users)
			.set({
				name: `${data.firstName} ${data.lastName}`,
				firstName: data.firstName,
				lastName: data.lastName,
				phone: data.phone ?? null,
				country: data.country,
				city: data.city ?? null,
				bio: data.bio ?? null,
				locale: data.locale,
				guardianName: minor ? data.guardianName! : null,
				guardianPhone: minor ? data.guardianPhone! : null,
				guardianEmail: minor ? data.guardianEmail! : null
			})
			.where(eq(users.id, userId));
		return 'ok';
	});
}
