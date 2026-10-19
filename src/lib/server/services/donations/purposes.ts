import { asc, eq } from 'drizzle-orm';
import { pickLocalized, type LocalizedText } from '#lib/i18n/localized.ts';
import type { Locale } from '#lib/i18n/locales.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { donationPurposes } from '../../db/schema/payments';

export type PurposeOption = { id: string; title: string };

/** docs/06 section 4.8: the purposes a donor can choose, in the admin's order. */
export async function listActivePurposes(db: LimitDb, locale: Locale): Promise<PurposeOption[]> {
	const rows = await db
		.select({ id: donationPurposes.id, title: donationPurposes.title })
		.from(donationPurposes)
		.where(eq(donationPurposes.isActive, true))
		.orderBy(asc(donationPurposes.sortOrder), asc(donationPurposes.createdAt));
	return rows.map((r) => ({ id: r.id, title: pickLocalized(r.title as LocalizedText, locale) }));
}
