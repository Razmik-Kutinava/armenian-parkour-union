<script lang="ts">
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { localizePath } from '#lib/i18n/locales.ts';
	import type { ShopCardView } from '#lib/server/services/shop/view.ts';
	import { mediaPhoto } from './media-photo';
	import { CARD_SIZES } from './placeholder-photo';

	/* docs/06 section 4.7: photo, title, price in points, "out of stock". */
	let { item, eager = false }: { item: ShopCardView; eager?: boolean } = $props();
</script>

<article class="flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
	<div class="flex aspect-square items-center justify-center bg-navy-100">
		{#if item.imageUrl}
			<img
				{...mediaPhoto(item.imageUrl)}
				sizes={CARD_SIZES}
				alt={item.imageAlt}
				loading={eager ? 'eager' : 'lazy'}
				width="800"
				height="800"
				class="size-full object-cover"
			/>
		{:else}
			<span class="text-sm text-ink-700">{t('shop.noPhoto')}</span>
		{/if}
	</div>
	<div class="flex flex-1 flex-col gap-2 p-4">
		<h2 class="text-lg font-bold text-ink-900">
			<a class="hover:underline" href={localizePath(`/shop/${item.slug}`, currentLocale())}
				>{item.title}</a
			>
		</h2>
		<p class="mt-auto flex flex-wrap items-center justify-between gap-2">
			<span class="font-bold text-navy-900">{t('shop.points', { points: item.pricePoints })}</span>
			{#if item.outOfStock}
				<span class="rounded-full bg-navy-100 px-3 py-1 text-sm text-ink-700"
					>{t('shop.outOfStock')}</span
				>
			{/if}
		</p>
	</div>
</article>
