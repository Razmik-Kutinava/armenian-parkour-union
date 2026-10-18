import type { Locale } from '#lib/i18n/locales.ts';
import { textFromHtml } from '#lib/seo/meta.ts';
import type { LimitDb } from '../auth/rate-limit';
import { listUpcomingEvents, type EventCard } from './events/public';
import { getPublishedPage } from './pages/public';
import { listPublishedPosts, type PostCard } from './posts/public';

/* docs/06 section 4.1: nearest 3 events, the start of "About", latest 3 news; empty — hidden. */

const HOME_CARDS = 3;
const ABOUT_MAX = 300;

export type HomeSections = {
	events: EventCard[];
	about: { title: string; excerpt: string } | null;
	news: PostCard[];
};

/** Plain text cut at a word, with an ellipsis when cut. */
function excerpt(html: string): string {
	const text = textFromHtml(html);
	if (text.length <= ABOUT_MAX) return text;
	const cut = text.slice(0, ABOUT_MAX);
	const space = cut.lastIndexOf(' ');
	return `${(space > ABOUT_MAX / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

export async function getHomeSections(db: LimitDb, locale: Locale): Promise<HomeSections> {
	const [events, news, about] = await Promise.all([
		listUpcomingEvents(db, { locale, page: 1 }),
		listPublishedPosts(db, { locale, page: 1 }),
		getPublishedPage(db, 'about', locale)
	]);
	return {
		events: events.rows.slice(0, HOME_CARDS),
		about: about ? { title: about.title, excerpt: excerpt(about.html) } : null,
		news: news.rows.slice(0, HOME_CARDS)
	};
}
