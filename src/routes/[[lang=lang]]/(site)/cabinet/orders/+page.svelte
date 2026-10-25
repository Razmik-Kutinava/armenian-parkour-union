<script lang="ts">
	import OrderStatusBadge from '#lib/components/shop/OrderStatusBadge.svelte';
	import { lineText } from '#lib/components/shop/order-lines.ts';
	import { newsDate } from '#lib/components/site/news-date.ts';
	import { currentLocale, localizePath, t } from '#lib/i18n/index.svelte.ts';
	import type { PageProps } from './$types';

	/* docs/06 section 5.8: number, lines, total, status, date; the number opens the card. */
	let { data }: PageProps = $props();
	const href = (path: string) => localizePath(path, currentLocale());
	const link = 'font-bold text-navy-700 underline hover:no-underline';
</script>

<svelte:head>
	<title>{t('cabinet.orders.title')} — {t('site.name')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex max-w-3xl flex-col gap-6">
	<h1 class="text-3xl font-bold text-ink-900">{t('cabinet.orders.title')}</h1>
	<p class="text-ink-700">{t('cabinet.orders.intro')}</p>
	{#if data.orders.length === 0}
		<p class="text-ink-700">
			{t('cabinet.orders.empty')}
			<a class={link} href={href('/shop')}>{t('cabinet.orders.toShop')}</a>
		</p>
	{:else}
		<ul class="divide-y divide-line rounded-md border border-line bg-surface">
			{#each data.orders as order (order.id)}
				<li class="flex flex-wrap items-start justify-between gap-3 p-4">
					<div class="flex min-w-0 flex-col gap-1">
						<a class={link} href={href(`/cabinet/orders/${order.id}`)}>{order.number}</a>
						<span class="text-sm text-ink-500">{newsDate(order.createdAt, currentLocale())}</span>
						{#each order.lines as line, i (i)}
							<span class="text-sm break-words text-ink-700">
								{lineText(line, currentLocale())}
							</span>
						{/each}
					</div>
					<div class="flex flex-wrap items-center gap-3">
						<span class="text-sm font-bold whitespace-nowrap text-ink-900">
							{t('shop.points', { points: order.totalPoints })}
						</span>
						<OrderStatusBadge status={order.status} />
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>
