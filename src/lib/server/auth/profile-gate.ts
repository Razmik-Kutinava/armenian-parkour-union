import { and, eq } from 'drizzle-orm';
import { defaultLocale, localizePath, type Locale } from '#lib/i18n/locales.ts';
import { account } from '../db/schema/auth';
import type { LimitDb } from './rate-limit';

const OPEN = new Set(['/complete-profile', '/logout']);

/** A Google sign-in creates the account without consent and birth date (decisions 2026-10-18). */
export async function needsProfile(
	db: LimitDb,
	user: { id: string; termsAcceptedAt?: unknown }
): Promise<boolean> {
	if (user.termsAcceptedAt) return false;
	const rows = await db
		.select({ id: account.id })
		.from(account)
		.where(and(eq(account.userId, user.id), eq(account.providerId, 'google')))
		.limit(1);
	return rows.length > 0;
}

/** Until the profile is complete only its form and logout open; anything else leads to the form. */
export function profileGateRedirect(pathname: string, locale: Locale): string | null {
	return OPEN.has(localizePath(pathname, defaultLocale))
		? null
		: localizePath('/complete-profile', locale);
}
