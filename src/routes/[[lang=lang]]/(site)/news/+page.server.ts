import { defaultLocale, isLocale, localizePath } from '#lib/i18n/locales.ts';
import { translate } from '#lib/i18n/translate.ts';
import { cached } from '#lib/server/cache/index.ts';
import { db } from '#lib/server/db/index.ts';
import { NEWS_PAGE_SIZE, listPublishedPosts } from '#lib/server/services/posts/public.ts';
import { siteUrl, withCover } from '#lib/server/services/posts/view.ts';
import { getSeoBase } from '#lib/server/services/seo/base.ts';
import { buildSeo } from '#lib/seo/meta.ts';
import { TAG_MAX } from '#lib/validation/posts.ts';
import type { PageServerLoad } from './$types';

/* docs/06 section 4.4: cards, filter by tag, 12 per page. */
export const load: PageServerLoad = async ({ params, url }) => {
	const locale = isLocale(params.lang) ? params.lang : defaultLocale;
	const tag = (url.searchParams.get('tag') ?? '').trim().toLowerCase().slice(0, TAG_MAX) || null;
	const rawPage = url.searchParams.get('page') ?? '';
	const page = /^\d{1,6}$/.test(rawPage) && Number(rawPage) >= 1 ? Number(rawPage) : 1;
	const [{ rows, total }, base] = await Promise.all([
		cached(['posts'], 'posts', listPublishedPosts, db, { locale, tag: tag ?? undefined, page }),
		cached(['settings'], 'seoBase', getSeoBase, db, locale, siteUrl(url))
	]);
	const query = new URLSearchParams({
		...(tag && { tag }),
		...(page > 1 && { page: String(page) })
	}).toString();
	const title = translate(locale, 'nav.news');
	return {
		tag,
		page,
		pages: Math.max(1, Math.ceil(total / NEWS_PAGE_SIZE)),
		posts: rows.map(withCover),
		seo: buildSeo({
			...base,
			path: localizePath('/news', locale) + (query ? `?${query}` : ''),
			title: tag ? `${title}: #${tag}` : title,
			description: translate(locale, 'news.list.description')
		})
	};
};
