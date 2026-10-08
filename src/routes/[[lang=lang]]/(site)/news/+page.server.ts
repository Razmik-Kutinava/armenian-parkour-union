import { defaultLocale, isLocale, localizePath } from '#lib/i18n/locales.ts';
import { translate } from '#lib/i18n/translate.ts';
import { db } from '#lib/server/db/index.ts';
import { NEWS_PAGE_SIZE, listPublishedPosts } from '#lib/server/services/posts/public.ts';
import { siteUrl, withCover } from '#lib/server/services/posts/view.ts';
import { buildSeo } from '#lib/seo/meta.ts';
import { TAG_MAX } from '#lib/validation/posts.ts';
import type { PageServerLoad } from './$types';

/* docs/06 section 4.4: cards, filter by tag, 12 per page. */
export const load: PageServerLoad = async ({ params, url }) => {
	const locale = isLocale(params.lang) ? params.lang : defaultLocale;
	const tag = (url.searchParams.get('tag') ?? '').trim().toLowerCase().slice(0, TAG_MAX) || null;
	const rawPage = url.searchParams.get('page') ?? '';
	const page = /^\d{1,6}$/.test(rawPage) && Number(rawPage) >= 1 ? Number(rawPage) : 1;
	const { rows, total } = await listPublishedPosts(db, { locale, tag: tag ?? undefined, page });
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
			siteUrl: siteUrl(url),
			siteName: translate(locale, 'site.name'),
			path: localizePath('/news', locale) + (query ? `?${query}` : ''),
			locale,
			title: tag ? `${title}: #${tag}` : title,
			description: translate(locale, 'news.list.description')
		})
	};
};
