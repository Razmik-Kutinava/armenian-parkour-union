<script lang="ts">
	import SeoHead from '#lib/components/site/SeoHead.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { localizePath } from '#lib/i18n/locales.ts';
	import ItemGallery from './ItemGallery.svelte';
	import OrderBox from './OrderBox.svelte';
	import type { PageProps } from './$types';

	/* docs/06 section 4.7: gallery, description, options, price, the order button. */
	let { data }: PageProps = $props();
</script>

<SeoHead seo={data.seo} />

<div class="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:py-14">
	<a
		class="text-sm font-bold text-navy-700 underline-offset-2 hover:underline"
		href={localizePath('/shop', currentLocale())}>← {t('shop.back')}</a
	>
	<div class="grid gap-8 md:grid-cols-2">
		<ItemGallery images={data.item.images} />
		<div class="flex flex-col gap-4">
			<h1 class="text-3xl font-bold text-ink-900 sm:text-4xl">{data.item.title}</h1>
			<p class="text-xl font-bold text-navy-900">
				{t('shop.points', { points: data.item.pricePoints })}
			</p>
			<OrderBox slug={data.item.slug} options={data.item.options} button={data.button} />
			{#if data.item.html}
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				<div class="rich-text">{@html data.item.html}</div>
			{/if}
		</div>
	</div>
</div>
