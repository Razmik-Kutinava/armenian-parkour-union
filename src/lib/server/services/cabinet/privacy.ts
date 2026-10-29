import { and, eq, isNull } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { users } from '../../db/schema/users';
import { isUuid } from '../users/target';

export type OwnPrivacy = { showCity: boolean; showAvatar: boolean };

/** docs/06 section 5.2 "Privacy": the member's own choice; a separate form from the profile. */
export async function updateOwnPrivacy(
	db: LimitDb,
	userId: string,
	privacy: OwnPrivacy
): Promise<'ok' | 'not_found'> {
	if (!isUuid(userId)) return 'not_found';
	const rows = await db
		.update(users)
		.set({ showCity: privacy.showCity, showAvatar: privacy.showAvatar })
		.where(and(eq(users.id, userId), isNull(users.deletedAt)))
		.returning({ id: users.id });
	return rows.length ? 'ok' : 'not_found';
}
