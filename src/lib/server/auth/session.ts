import { defaultLocale, isLocale, type Locale } from '#lib/i18n/locales.ts';
import { membershipLevel, userRole } from '../db/schema/enums';

export type UserRole = (typeof userRole.enumValues)[number];
export type MembershipLevel = (typeof membershipLevel.enumValues)[number];

/** What pages and actions get as `locals.user`. Contacts and birth date stay out (docs/04 section 4). */
export type LocalsUser = {
	id: string;
	email: string;
	name: string;
	emailVerified: boolean;
	role: UserRole;
	locale: Locale;
	level: MembershipLevel | null;
};

type SessionUser = {
	id: string;
	email: string;
	name: string;
	emailVerified: boolean;
	role?: unknown;
	status?: unknown;
	deletedAt?: unknown;
	locale?: unknown;
	level?: unknown;
};

const isRole = (v: unknown): v is UserRole =>
	(userRole.enumValues as readonly unknown[]).includes(v);
const isLevel = (v: unknown): v is MembershipLevel =>
	(membershipLevel.enumValues as readonly unknown[]).includes(v);

/** docs/04 section 5.2: a blocked or deleted user is a guest; anything unexpected is a guest too. */
export function toLocalsUser(user: SessionUser | null | undefined): LocalsUser | null {
	if (!user || user.status !== 'active' || user.deletedAt || !isRole(user.role)) return null;
	return {
		id: user.id,
		email: user.email,
		name: user.name,
		emailVerified: user.emailVerified,
		role: user.role,
		locale: isLocale(user.locale) ? user.locale : defaultLocale,
		level: isLevel(user.level) ? user.level : null
	};
}
