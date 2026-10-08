<script lang="ts">
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { localizePath } from '#lib/i18n/locales.ts';
	import type { PublicPost } from '#lib/server/services/posts/public.ts';
	import type { CardView } from '#lib/server/services/posts/view.ts';
	import NewsCard from './NewsCard.svelte';
	import ShareButton from './ShareButton.svelte';
	import { newsDate } from './news-date';

	/* docs/06 section 4.4: title, date, cover, text, tags, share, "read also". HTML cleaned on save. */
	type Props = {
		post: PublicPost & { coverUrl: string | null };
		related: CardView[];
		shareUrl: string;
	};
	let { post, related, shareUrl }: Props = $props();
	const href = (path: string) => localizePath(path, currentLocale());
</script>

<article class="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:py-14">
	<header class="flex flex-col gap-3">
		<h1 class="text-3xl font-bold text-ink-900 sm:text-4xl">{post.title}</h1>
		{#if post.publishedAt}
			<time class="text-ink-500" datetime={post.publishedAt.toISOString()}
				>{newsDate(post.publishedAt, currentLocale())}</time
			>
		{/if}
	</header>
	{#if post.coverUrl}
		<img
			src={post.coverUrl}
			alt={post.coverAlt}
			width="1200"
			height="630"
			class="aspect-[1.91/1] w-full rounded-lg object-cover"
		/>
	{/if}
	{#if post.html}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<div class="rich-text">{@html post.html}</div>
	{/if}
	<footer class="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
		{#if post.tags.length}
			<ul class="flex flex-wrap gap-2" aria-label={t('news.tags')}>
				{#each post.tags as tag (tag)}
					<li>
						<a
							class="rounded-full bg-navy-100 px-3 py-1 text-sm text-navy-900 hover:bg-navy-300"
							href={href(`/news?tag=${encodeURIComponent(tag)}`)}>#{tag}</a
						>
					</li>
				{/each}
			</ul>
		{/if}
		<ShareButton title={post.title} url={shareUrl} />
	</footer>
</article>

{#if related.length}
	<section class="mx-auto max-w-5xl px-4 pb-14" aria-labelledby="related-title">
		<h2 id="related-title" class="mb-4 text-2xl font-bold text-ink-900">{t('news.related')}</h2>
		<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each related as card (card.slug)}<NewsCard post={card} />{/each}
		</div>
	</section>
{/if}
