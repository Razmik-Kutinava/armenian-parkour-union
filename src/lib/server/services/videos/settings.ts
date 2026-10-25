import { eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { siteSettings } from '../../db/schema/service';
import { writeSettings } from '../site-settings';
import type { Actor } from '../users/target';
import type { VideoPlatform } from './link';

/* docs/03 section 6.2 p. 7, 8 p. 1, 16: `site_settings.videos`; decisions.md 2026-10-24 (7.1). */

export type VideoSettings = {
	/** Videos a member may add in one calendar month in Yerevan. */
	monthlyLimit: number;
	platforms: VideoPlatform[];
};

export const VIDEO_DEFAULTS: VideoSettings = {
	monthlyLimit: 5,
	platforms: ['youtube', 'instagram']
};

const ALL: readonly VideoPlatform[] = ['youtube', 'instagram'];

const isLimit = (v: unknown): v is number =>
	typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 100;

const isPlatforms = (v: unknown): v is VideoPlatform[] =>
	Array.isArray(v) && v.length >= 1 && v.every((p) => ALL.includes(p));

/** The stored snake_case value; a missing or broken field — its default. */
export function parseVideoSettings(value: unknown): VideoSettings {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return VIDEO_DEFAULTS;
	const { monthly_limit: limit, platforms } = value as Record<string, unknown>;
	return {
		monthlyLimit: isLimit(limit) ? limit : VIDEO_DEFAULTS.monthlyLimit,
		platforms: isPlatforms(platforms) ? [...new Set(platforms)] : VIDEO_DEFAULTS.platforms
	};
}

export async function videoSettings(db: LimitDb): Promise<VideoSettings> {
	const [row] = await db
		.select({ value: siteSettings.value })
		.from(siteSettings)
		.where(eq(siteSettings.key, 'videos'));
	return parseVideoSettings(row?.value);
}

/** Admin only (docs/04: settings.write); `writeSettings` logs `settings.update` with before / after. */
export async function saveVideoSettings(
	db: LimitDb,
	actor: Actor,
	values: VideoSettings,
	ip: string | null
): Promise<'ok' | 'not_admin'> {
	if (actor.role !== 'admin') return 'not_admin';
	const stored = { monthly_limit: values.monthlyLimit, platforms: [...new Set(values.platforms)] };
	await writeSettings(db, actor, { videos: stored }, ip);
	return 'ok';
}
