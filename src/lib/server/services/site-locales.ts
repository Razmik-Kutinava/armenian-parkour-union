import { eq } from 'drizzle-orm';
import { defaultLocale, locales, type Locale } from '#lib/i18n/locales.ts';
import type { LimitDb } from '../auth/rate-limit';
import { siteSettings } from '../db/schema/service';
import { writeSettings } from './site-settings';
import type { Actor } from './users/target';

/* docs/06 section 1 p. 2, 7.4: Armenian and Russian are switched on as translations get ready.
 * `site_settings.locales` = { enabled: [...] }; no key or a broken one — all languages. */

/** English is always on; the order is the switcher's. */
function normalize(codes: readonly unknown[]): Locale[] {
	return locales.filter((l) => l === defaultLocale || codes.includes(l));
}

export function parseSiteLocales(value: unknown): Locale[] {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return [...locales];
	const { enabled } = value as Record<string, unknown>;
	return Array.isArray(enabled) ? normalize(enabled) : [...locales];
}

export async function siteLocales(db: LimitDb): Promise<Locale[]> {
	const [row] = await db
		.select({ value: siteSettings.value })
		.from(siteSettings)
		.where(eq(siteSettings.key, 'locales'));
	return parseSiteLocales(row?.value);
}

/** Admin only (docs/04: settings.write); `writeSettings` logs `settings.update` with before / after. */
export async function saveSiteLocales(
	db: LimitDb,
	actor: Actor,
	codes: readonly unknown[],
	ip: string | null
): Promise<'ok' | 'not_admin'> {
	if (actor.role !== 'admin') return 'not_admin';
	await writeSettings(db, actor, { locales: { enabled: normalize(codes) } }, ip);
	return 'ok';
}
