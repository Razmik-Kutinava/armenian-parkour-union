<script lang="ts">
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { localizePath } from '#lib/i18n/locales.ts';
	import type { CardView } from '#lib/server/services/posts/view.ts';
	import { newsDate } from './news-date';

	/* docs/06 section 4.4: cover, title, short text, date, tags. */
	let { post, eager = false }: { post: CardView; eager?: boolean } = $props();
	const href = (path: string) => localizePath(path, currentLocale());
</script>

<article class="flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
	<div class="aspect-[1.91/1] bg-navy-100">
		{#if post.coverUrl}
			<img
				src={post.coverUrl}
				alt={post.coverAlt}
				loading={eager ? 'eager' : 'lazy'}
				width="1200"
				height="630"
				class="size-full object-cover"
			/>
		{/if}
	</div>
	<div class="flex flex-1 flex-col gap-2 p-4">
		{#if post.publishedAt}
			<time class="text-sm text-ink-500" datetime={post.publishedAt.toISOString()}
				>{newsDate(post.publishedAt, currentLocale())}</time
			>
		{/if}
		<h2 class="text-lg font-bold text-ink-900">
			<a class="hover:underline" href={href(`/news/${post.slug}`)}>{post.title}</a>
		</h2>
		{#if post.excerpt}<p class="text-ink-700">{post.excerpt}</p>{/if}
		{#if post.tags.length}
			<ul class="mt-auto flex flex-wrap gap-2 pt-2" aria-label={t('news.tags')}>
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
	</div>
</article>
