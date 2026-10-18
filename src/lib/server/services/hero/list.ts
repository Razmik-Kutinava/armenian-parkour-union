import { and, asc, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import type { LocalizedText } from '#lib/i18n/localized.ts';
import type { HeroType } from '#lib/validation/hero-enums.ts';
import type { HeroValues } from '#lib/validation/hero.ts';
import type { PostText } from '#lib/validation/posts.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { heroBlocks } from '../../db/schema/hero';
import { isUuid } from '../users/target';
import { shownHeroIds } from './public';

/* docs/05 section 4: cards in order with the switch and the period; filters type and active. */

export type HeroRow = {
	id: string;
	type: HeroType;
	title: LocalizedText;
	isActive: boolean;
	startsAt: Date | null;
	endsAt: Date | null;
	mediaKey: string | null;
	archivedAt: Date | null;
	/** On the home page right now. */
	onHome: boolean;
};

export type HeroFilter = { archived?: boolean; type?: HeroType; active?: boolean };

export async function listHeroBlocks(db: LimitDb, filter: HeroFilter): Promise<HeroRow[]> {
	const rows = await db
		.select({
			id: heroBlocks.id,
			type: heroBlocks.type,
			title: heroBlocks.title,
			isActive: heroBlocks.isActive,
			startsAt: heroBlocks.startsAt,
			endsAt: heroBlocks.endsAt,
			mediaKey: heroBlocks.mediaKey,
			archivedAt: heroBlocks.archivedAt
		})
		.from(heroBlocks)
		.where(
			and(
				filter.archived ? isNotNull(heroBlocks.archivedAt) : isNull(heroBlocks.archivedAt),
				filter.type ? eq(heroBlocks.type, filter.type) : undefined,
				filter.active === undefined ? undefined : eq(heroBlocks.isActive, filter.active)
			)
		)
		.orderBy(
			...(filter.archived
				? [desc(heroBlocks.archivedAt)]
				: [asc(heroBlocks.sortOrder), asc(heroBlocks.createdAt)]),
			asc(heroBlocks.id)
		)
		.limit(200);
	const onHome = new Set(await shownHeroIds(db));
	return rows.map((r) => ({
		...r,
		title: r.title as LocalizedText,
		onHome: onHome.has(r.id)
	}));
}

export type HeroDetail = HeroValues & {
	id: string;
	sortOrder: number;
	archivedAt: Date | null;
	createdBy: string | null;
};

export async function getHeroBlock(db: LimitDb, id: string): Promise<HeroDetail | null> {
	if (!isUuid(id)) return null;
	const [row] = await db.select().from(heroBlocks).where(eq(heroBlocks.id, id));
	if (!row) return null;
	return {
		id: row.id,
		type: row.type,
		title: row.title as HeroValues['title'],
		subtitle: row.subtitle as PostText,
		mediaKey: row.mediaKey,
		videoUrl: row.videoUrl,
		ctaLabel: row.ctaLabel as PostText | null,
		ctaUrl: row.ctaUrl,
		eventId: row.eventId,
		personUserId: row.personUserId,
		startsAt: row.startsAt,
		endsAt: row.endsAt,
		isActive: row.isActive,
		sortOrder: row.sortOrder,
		archivedAt: row.archivedAt,
		createdBy: row.createdBy
	};
}
