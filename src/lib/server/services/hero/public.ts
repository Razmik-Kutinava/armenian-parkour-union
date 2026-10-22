import { and, asc, eq, gte, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import { parseVideoUrl, type VideoLink } from '#lib/components/site/hero/youtube.ts';
import { pickLocalized, type LocalizedText } from '#lib/i18n/localized.ts';
import type { Locale } from '#lib/i18n/locales.ts';
import type { HeroType } from '#lib/validation/hero-enums.ts';
import type { PostText } from '#lib/validation/posts.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { events } from '../../db/schema/events';
import { heroBlocks } from '../../db/schema/hero';
import { users } from '../../db/schema/users';
import { heroLimit } from './checks';
import { adultPerson } from './persons';

/* docs/03 section 11: what the home page shows; nothing to show — nearest event, else a banner. */

export type HeroSlide = {
	/** `null` for the fallback slides. */
	id: string | null;
	type: HeroType | 'banner';
	title: string;
	subtitle: string;
	mediaKey: string | null;
	video: VideoLink | null;
	cta: { label: string; url: string } | null;
	event: { slug: string; title: string; startsAt: Date; endsAt: Date; city: string | null } | null;
	/** Only the name of an adult (K4); the avatar only with the member's consent. */
	person: { name: string; avatarKey: string | null } | null;
};

/** Guests can open it and it has not ended: a draft, cancelled or deleted event hides the block. */
const eventLive = and(
	eq(events.status, 'published'),
	lte(events.publishedAt, sql`now()`),
	isNull(events.deletedAt),
	gte(events.endsAt, sql`now()`)
);

const shown = and(
	eq(heroBlocks.isActive, true),
	isNull(heroBlocks.archivedAt),
	or(isNull(heroBlocks.startsAt), lte(heroBlocks.startsAt, sql`now()`)),
	or(isNull(heroBlocks.endsAt), sql`${heroBlocks.endsAt} > now()`),
	or(sql`${heroBlocks.type} <> 'event'`, eventLive),
	or(sql`${heroBlocks.type} <> 'person'`, adultPerson)
);

const pick = (text: unknown, locale: Locale) => {
	const t = (text ?? {}) as PostText;
	return t[locale] || t.en || '';
};

const blank = { subtitle: '', mediaKey: null, video: null, cta: null, event: null, person: null };

/** Blocks with their event and person (the person only if an adult, K4). */
export function heroRows(db: LimitDb, where: SQL | undefined, limit: number) {
	return db
		.select({
			block: heroBlocks,
			event: {
				slug: events.slug,
				title: events.title,
				startsAt: events.startsAt,
				endsAt: events.endsAt,
				city: events.city,
				coverKey: events.coverKey
			},
			person: { name: users.name, avatarKey: users.avatarKey }
		})
		.from(heroBlocks)
		.leftJoin(events, eq(events.id, heroBlocks.eventId))
		.leftJoin(users, and(eq(users.id, heroBlocks.personUserId), adultPerson))
		.where(where)
		.orderBy(asc(heroBlocks.sortOrder), asc(heroBlocks.createdAt), asc(heroBlocks.id))
		.limit(limit);
}

type HeroRowJoined = Awaited<ReturnType<typeof heroRows>>[number];

/** Switching on keeps the active blocks within the limit, so it is read alongside, not before. */
const SHOWN_SCAN = 100;
async function shownRows(db: LimitDb) {
	const [limit, rows] = await Promise.all([heroLimit(db), heroRows(db, shown, SHOWN_SCAN)]);
	return rows.slice(0, limit);
}

/** Ids of the blocks on the home page now (the admin list marks them). */
export async function shownHeroIds(db: LimitDb): Promise<string[]> {
	return (await shownRows(db)).map((r) => r.block.id);
}

async function fallback(db: LimitDb, locale: Locale): Promise<HeroSlide> {
	const [event] = await db
		.select()
		.from(events)
		.where(eventLive)
		.orderBy(asc(events.startsAt), asc(events.id))
		.limit(1);
	if (!event) return { id: null, type: 'banner', title: '', ...blank };
	const { slug, startsAt, endsAt, city } = event;
	const title = pickLocalized(event.title as LocalizedText, locale);
	return {
		id: null,
		type: 'event',
		title,
		...blank,
		mediaKey: event.coverKey,
		event: { slug, title, startsAt, endsAt, city }
	};
}

/** A video block with a link that no longer parses is not shown (`null`). */
export function toSlide({ block, event, person }: HeroRowJoined, locale: Locale): HeroSlide | null {
	const video = block.videoUrl ? parseVideoUrl(block.videoUrl) : null;
	if (block.type === 'video' && !video) return null;
	const label = pick(block.ctaLabel, locale);
	const linked = block.type === 'event' && event;
	return {
		id: block.id,
		type: block.type,
		title: pick(block.title, locale),
		subtitle: pick(block.subtitle, locale),
		mediaKey: block.mediaKey ?? (linked ? event.coverKey : null),
		video,
		cta: block.ctaUrl && label ? { label, url: block.ctaUrl } : null,
		event: linked
			? {
					slug: event.slug,
					title: pickLocalized(event.title as LocalizedText, locale),
					startsAt: event.startsAt,
					endsAt: event.endsAt,
					city: event.city
				}
			: null,
		/* decisions.md 2026-10-22: no photo in public until the member allows it (`show_avatar`). */
		person: block.type === 'person' && person ? { name: person.name, avatarKey: null } : null
	};
}

export async function getHeroSlides(db: LimitDb, locale: Locale): Promise<HeroSlide[]> {
	const slides = (await shownRows(db))
		.map((row) => toSlide(row, locale))
		.filter((s): s is HeroSlide => s !== null);
	return slides.length ? slides : [await fallback(db, locale)];
}
