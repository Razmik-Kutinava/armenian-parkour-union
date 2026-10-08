import { PUBLIC_SITE_URL } from '$app/env/private';
import { localizePath, type Locale } from '#lib/i18n/locales.ts';
import { translate } from '#lib/i18n/translate.ts';
import { buildSeo, textFromHtml, type Seo } from '#lib/seo/meta.ts';
import { publicUrl } from '../../storage/r2';
import type { PostCard, PublicPost } from './public';

/* What the news pages render: cover addresses from R2 and the meta for messengers (docs/06 § 7). */

export type CardView = PostCard & { coverUrl: string | null };

export const withCover = <T extends PostCard>(post: T): T & { coverUrl: string | null } => ({
	...post,
	coverUrl: post.coverKey ? publicUrl(post.coverKey) : null
});

export const siteUrl = (url: URL) => PUBLIC_SITE_URL || url.origin;

export function postSeo(post: PublicPost, locale: Locale, url: URL): Seo {
	const coverUrl = post.coverKey ? publicUrl(post.coverKey) : null;
	return buildSeo({
		siteUrl: siteUrl(url),
		siteName: translate(locale, 'site.name'),
		path: localizePath(`/news/${post.slug}`, locale),
		locale,
		title: post.title,
		description:
			post.excerpt || textFromHtml(post.html) || translate(locale, 'news.list.description'),
		image: coverUrl ? { url: coverUrl, alt: post.coverAlt } : null,
		article: {
			publishedAt: post.publishedAt ?? post.updatedAt,
			modifiedAt: post.updatedAt,
			tags: post.tags
		}
	});
}
