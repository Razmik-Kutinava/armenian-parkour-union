import type { Locale } from '#lib/i18n/locales.ts';
import { eventMarkup } from './event';

/* docs/06 section 7: title, description, Open Graph with an image, canonical address, markup. */

export type SeoInput = {
	/** PUBLIC_SITE_URL, or the request origin when it is not set. */
	siteUrl: string;
	siteName: string;
	path: string;
	locale: Locale;
	title: string;
	description: string;
	image?: { url: string; alt: string } | null;
	article?: { publishedAt: Date; modifiedAt: Date; tags: string[] };
	event?: SeoEvent;
};
export type SeoEvent = {
	startsAt: Date;
	endsAt: Date;
	cancelled: boolean;
	place: { name: string | null; address: string | null; city: string | null } | null;
	price: { amountMinor: number; currency: string };
};
export type MetaTag = { property?: string; name?: string; content: string };
export type Seo = {
	title: string;
	description: string;
	canonical: string;
	tags: MetaTag[];
	/** Ready for `<script type="application/ld+json">`: `<` is escaped. */
	jsonLd: string | null;
};

const DESCRIPTION_MAX = 200;
const OG_LOCALE: Record<Locale, string> = { en: 'en_US', hy: 'hy_AM', ru: 'ru_RU' };

function shorten(text: string): string {
	const clean = text.replace(/\s+/g, ' ').trim();
	if (clean.length <= DESCRIPTION_MAX) return clean;
	const cut = clean.slice(0, DESCRIPTION_MAX - 1);
	const space = cut.lastIndexOf(' ');
	return `${(space > 0 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

const ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	'#39': "'",
	nbsp: ' '
};

/** Plain text of cleaned editor HTML, for a description when there is no excerpt. */
export function textFromHtml(html: string): string {
	return html
		.replace(/<[^>]*>/g, ' ')
		.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, name: string) => ENTITIES[name])
		.replace(/\s+/g, ' ')
		.trim();
}

export function buildSeo(input: SeoInput): Seo {
	const canonical = `${input.siteUrl.replace(/\/+$/, '')}${input.path}`;
	const description = shorten(input.description);
	const { image, article } = input;
	const tags: MetaTag[] = [
		{ property: 'og:title', content: input.title },
		{ property: 'og:description', content: description },
		{ property: 'og:url', content: canonical },
		{ property: 'og:site_name', content: input.siteName },
		{ property: 'og:locale', content: OG_LOCALE[input.locale] },
		{ property: 'og:type', content: article ? 'article' : 'website' },
		{ name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' }
	];
	if (image) {
		tags.push({ property: 'og:image', content: image.url });
		if (image.alt) tags.push({ property: 'og:image:alt', content: image.alt });
	}
	if (article) {
		tags.push(
			{ property: 'article:published_time', content: article.publishedAt.toISOString() },
			{ property: 'article:modified_time', content: article.modifiedAt.toISOString() },
			...article.tags.map((tag) => ({ property: 'article:tag', content: tag }))
		);
	}
	const organization = { '@type': 'Organization', name: input.siteName };
	const markup = article
		? {
				'@context': 'https://schema.org',
				'@type': 'Article',
				headline: input.title,
				description,
				...(image && { image: [image.url] }),
				datePublished: article.publishedAt.toISOString(),
				dateModified: article.modifiedAt.toISOString(),
				inLanguage: input.locale,
				...(article.tags.length > 0 && { keywords: article.tags.join(', ') }),
				mainEntityOfPage: canonical,
				author: organization,
				publisher: organization
			}
		: input.event && eventMarkup(input, input.event, description, canonical, organization);
	const jsonLd = markup ? JSON.stringify(markup).replace(/</g, '\\u003c') : null;
	return {
		title: `${input.title} — ${input.siteName}`,
		description,
		canonical,
		tags,
		jsonLd
	};
}
