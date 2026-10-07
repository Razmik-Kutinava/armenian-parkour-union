import { eq } from 'drizzle-orm';
import type { Locale } from '#lib/i18n/locales.ts';
import type { LimitDb } from '../auth/rate-limit';
import { users } from '../db/schema/users';

/** Interface language of the user's own profile (admin panel now, cabinet in stage 5). */
export async function setLocale(db: LimitDb, userId: string, locale: Locale): Promise<void> {
	await db.update(users).set({ locale }).where(eq(users.id, userId));
}
