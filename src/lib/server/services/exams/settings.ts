import { eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { siteSettings } from '../../db/schema/service';

/* docs/03 section 16: `site_settings.exams`; both values are "to be set", by default no limit. */

export type ExamSettings = {
	/** Days after a failed exam before the retake date. */
	retakeDays: number;
	/** Days on the current level before a level exam date. */
	minDaysOnLevel: number;
};

export const EXAM_DEFAULTS: ExamSettings = { retakeDays: 0, minDaysOnLevel: 0 };

const isDays = (v: unknown): v is number =>
	typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 3650;

/** The stored snake_case value; missing or broken — the defaults. */
export function parseExamSettings(value: unknown): ExamSettings {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return EXAM_DEFAULTS;
	const v = value as Record<string, unknown>;
	if (!isDays(v.retake_days) || !isDays(v.min_days_on_level)) return EXAM_DEFAULTS;
	return { retakeDays: v.retake_days, minDaysOnLevel: v.min_days_on_level };
}

export async function examSettings(db: LimitDb): Promise<ExamSettings> {
	const [row] = await db
		.select({ value: siteSettings.value })
		.from(siteSettings)
		.where(eq(siteSettings.key, 'exams'));
	return parseExamSettings(row?.value);
}
