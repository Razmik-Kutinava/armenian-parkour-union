import { eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { siteSettings } from '../../db/schema/service';

/* docs/03 section 4.6, 16: `site_settings.certificates`; coach and judge — 2 years by default.
 * docs/08 section 10: Russian in the PDF is optional (on by default, questions.md stage 6).
 * Letters before a coach or judge certificate ends — 30 and 7 days (questions.md stage 6, 6.9). */

export type CertificateSettings = {
	/** Months a coach or judge certificate is valid by default. */
	staffValidMonths: number;
	/** The PDF carries Russian next to Armenian and English. */
	pdfRussian: boolean;
	/** Days before a coach or judge certificate ends when a letter goes. */
	staffRemindDays: number[];
};

export const CERTIFICATE_DEFAULTS: CertificateSettings = {
	staffValidMonths: 24,
	pdfRussian: true,
	staffRemindDays: [30, 7]
};

const isMonths = (v: unknown): v is number =>
	typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 1200;

const isDay = (v: unknown): v is number =>
	typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 365;

const isRemindDays = (v: unknown): v is number[] =>
	Array.isArray(v) && v.length >= 1 && v.length <= 10 && v.every(isDay);

/** The stored snake_case value; a missing or broken field — its default. */
export function parseCertificateSettings(value: unknown): CertificateSettings {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return CERTIFICATE_DEFAULTS;
	const {
		staff_valid_months: months,
		pdf_russian: russian,
		staff_remind_days: remind
	} = value as Record<string, unknown>;
	return {
		staffValidMonths: isMonths(months) ? months : CERTIFICATE_DEFAULTS.staffValidMonths,
		pdfRussian: typeof russian === 'boolean' ? russian : CERTIFICATE_DEFAULTS.pdfRussian,
		staffRemindDays: isRemindDays(remind) ? remind : CERTIFICATE_DEFAULTS.staffRemindDays
	};
}

export async function certificateSettings(db: LimitDb): Promise<CertificateSettings> {
	const [row] = await db
		.select({ value: siteSettings.value })
		.from(siteSettings)
		.where(eq(siteSettings.key, 'certificates'));
	return parseCertificateSettings(row?.value);
}
