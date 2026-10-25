<script lang="ts">
	import SeoHead from '#lib/components/site/SeoHead.svelte';
	import ShopCard from '#lib/components/site/ShopCard.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { localizePath } from '#lib/i18n/locales.ts';
	import type { PageProps } from './$types';

	/* docs/06 section 4.7: the catalog. */
	let { data }: PageProps = $props();
	const list = $derived(localizePath('/shop', currentLocale()));
	const pageHref = (page: number) => (page > 1 ? `${list}?page=${page}` : list);
	const link = 'font-bold text-navy-700 underline-offset-2 hover:underline';
</script>

<SeoHead seo={data.seo} />

<div class="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:py-14">
	<h1 class="text-3xl font-bold text-ink-900 sm:text-4xl">{t('shop.title')}</h1>
	<p class="text-ink-700">{t('shop.description')}</p>

	{#if data.items.length === 0}
		<p class="text-ink-700">{t('shop.empty')}</p>
	{:else}
		<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.items as item, i (item.slug)}<ShopCard {item} eager={i < 3} />{/each}
		</div>
	{/if}

	{#if data.pages > 1}
		<nav class="flex justify-between" aria-label={t('table.pagination')}>
			{#if data.page > 1}
				<a class={link} href={pageHref(data.page - 1)}>← {t('shop.prev')}</a>
			{:else}<span></span>{/if}
			<span class="text-ink-500">{t('table.pageOf', { page: data.page, pages: data.pages })}</span>
			{#if data.page < data.pages}
				<a class={link} href={pageHref(data.page + 1)}>{t('shop.next')} →</a>
			{:else}<span></span>{/if}
		</nav>
	{/if}
</div>
