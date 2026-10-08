<script lang="ts">
	import NewsCard from '#lib/components/site/NewsCard.svelte';
	import SeoHead from '#lib/components/site/SeoHead.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { localizePath } from '#lib/i18n/locales.ts';
	import type { PageProps } from './$types';

	/* docs/06 section 4.4: cards with cover, title, short text, date, tags; tag filter; pages. */
	let { data }: PageProps = $props();
	const list = $derived(localizePath('/news', currentLocale()));
	const pageHref = (page: number) => {
		const q = new URLSearchParams({
			...(data.tag && { tag: data.tag }),
			...(page > 1 && { page: String(page) })
		}).toString();
		return q ? `${list}?${q}` : list;
	};
	const link = 'font-bold text-navy-700 underline-offset-2 hover:underline';
</script>

<SeoHead seo={data.seo} />

<div class="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:py-14">
	<h1 class="text-3xl font-bold text-ink-900 sm:text-4xl">{t('nav.news')}</h1>
	{#if data.tag}
		<p class="flex flex-wrap items-center gap-3 text-ink-700">
			{t('news.list.tag', { tag: data.tag })}
			<a class={link} href={list}>{t('news.list.all')}</a>
		</p>
	{/if}

	{#if data.posts.length === 0}
		<p class="text-ink-700">{t('news.list.empty')}</p>
	{:else}
		<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.posts as post, i (post.slug)}<NewsCard {post} eager={i < 3} />{/each}
		</div>
	{/if}

	{#if data.pages > 1}
		<nav class="flex justify-between" aria-label={t('table.pagination')}>
			{#if data.page > 1}
				<a class={link} href={pageHref(data.page - 1)}>← {t('news.newer')}</a>
			{:else}<span></span>{/if}
			<span class="text-ink-500">{t('table.pageOf', { page: data.page, pages: data.pages })}</span>
			{#if data.page < data.pages}
				<a class={link} href={pageHref(data.page + 1)}>{t('news.older')} →</a>
			{:else}<span></span>{/if}
		</nav>
	{/if}
</div>
