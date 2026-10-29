import { and, asc, eq, exists, isNull } from 'drizzle-orm';
import type { LocalizedText } from '#lib/i18n/localized.ts';
import type { Locale } from '#lib/i18n/locales.ts';
import { isMinor } from '#lib/validation/auth.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { staffProfiles, certificates } from '../../db/schema/certification';
import { consents } from '../../db/schema/consents';
import { users } from '../../db/schema/users';
import { holderName } from '../certificates/pdf-content';
import { inForce } from '../consents/valid';
import { liveCertificateOf } from './profile';

/* docs/06 section 4.6: photo, name, category, description. A minor — or an unknown birth date —
 * shows the photo and the description only with the `privacy` consent (docs/03 section 13 p. 3);
 * the photo also needs the member's own `show_avatar` (decisions.md 2026-10-22).
 * Contacts, the birth date and ids never leave this function. */

export type StaffCard = {
	name: string;
	category: string | null;
	avatarKey: string | null;
	bio: string | null;
};
export type PublicStaff = { trainers: StaffCard[]; judges: StaffCard[] };

function bioText(bio: unknown, locale: Locale): string | null {
	if (!bio || typeof bio !== 'object') return null;
	const text = (bio as Partial<LocalizedText>)[locale] || (bio as Partial<LocalizedText>).en;
	return typeof text === 'string' && text.trim() ? text.trim() : null;
}

export async function listPublicStaff(
	db: LimitDb,
	locale: Locale,
	now = new Date()
): Promise<PublicStaff> {
	const privacy = db
		.select({ id: consents.id })
		.from(consents)
		.where(and(eq(consents.userId, users.id), eq(consents.kind, 'privacy'), inForce(now)));
	const live = db
		.select({ id: certificates.id })
		.from(certificates)
		.where(liveCertificateOf(staffProfiles.userId, staffProfiles.kind, now));
	const rows = await db
		.select({
			kind: staffProfiles.kind,
			category: staffProfiles.category,
			bio: staffProfiles.bio,
			name: users.name,
			firstName: users.firstName,
			lastName: users.lastName,
			avatarKey: users.avatarKey,
			showAvatar: users.showAvatar,
			birthDate: users.birthDate,
			privacy: exists(privacy).mapWith(Boolean)
		})
		.from(staffProfiles)
		.innerJoin(users, eq(users.id, staffProfiles.userId))
		.where(
			and(
				eq(staffProfiles.isPublic, true),
				eq(staffProfiles.isActive, true),
				eq(users.status, 'active'),
				isNull(users.deletedAt),
				exists(live)
			)
		)
		.orderBy(asc(users.lastName), asc(users.firstName), asc(users.name));
	const team: PublicStaff = { trainers: [], judges: [] };
	for (const r of rows) {
		const shown = r.privacy || (r.birthDate !== null && !isMinor(r.birthDate, now));
		const card = {
			name: holderName(r),
			category: r.category,
			avatarKey: shown && r.showAvatar ? r.avatarKey : null,
			bio: shown ? bioText(r.bio, locale) : null
		};
		(r.kind === 'trainer' ? team.trainers : team.judges).push(card);
	}
	return team;
}
