import { eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { siteSettings } from '../../db/schema/service';

/* docs/03 section 4.6, 16: `site_settings.certificates`; coach and judge — 2 years by default. */

export type CertificateSettings = {
	/** Months a coach or judge certificate is valid by default. */
	staffValidMonths: number;
};

export const CERTIFICATE_DEFAULTS: CertificateSettings = { staffValidMonths: 24 };

const isMonths = (v: unknown): v is number =>
	typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 1200;

/** The stored snake_case value; missing or broken — the defaults. */
export function parseCertificateSettings(value: unknown): CertificateSettings {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return CERTIFICATE_DEFAULTS;
	const months = (value as Record<string, unknown>).staff_valid_months;
	return isMonths(months) ? { staffValidMonths: months } : CERTIFICATE_DEFAULTS;
}

export async function certificateSettings(db: LimitDb): Promise<CertificateSettings> {
	const [row] = await db
		.select({ value: siteSettings.value })
		.from(siteSettings)
		.where(eq(siteSettings.key, 'certificates'));
	return parseCertificateSettings(row?.value);
}
