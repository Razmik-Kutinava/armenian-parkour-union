import { eq } from 'drizzle-orm';
import type { Locale } from '#lib/i18n/locales.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { heroBlocks } from '../../db/schema/hero';
import { isUuid } from '../users/target';
import { heroRows, toSlide, type HeroSlide } from './public';

/** docs/05 section 4: the saved block as on the home page, whatever its switch and period. */
export async function getHeroPreview(
	db: LimitDb,
	id: string,
	locale: Locale
): Promise<HeroSlide | null> {
	if (!isUuid(id)) return null;
	const [row] = await heroRows(db, eq(heroBlocks.id, id), 1);
	return row ? toSlide(row, locale) : null;
}
