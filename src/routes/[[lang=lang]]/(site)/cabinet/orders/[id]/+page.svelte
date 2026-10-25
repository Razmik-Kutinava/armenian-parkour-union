<script lang="ts">
	import { enhance } from '$app/forms';
	import OrderStatusBadge from '#lib/components/shop/OrderStatusBadge.svelte';
	import { optionsText } from '#lib/components/shop/order-lines.ts';
	import { newsDate } from '#lib/components/site/news-date.ts';
	import Button from '#lib/components/ui/Button.svelte';
	import { currentLocale, localizePath, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import type { PageProps } from './$types';

	/* docs/06 section 5.8: lines, delivery, shipping note; "Cancel" while the order is new — the
	 * server checks it again. */
	let { data, form }: PageProps = $props();
	const order = $derived(data.order);
	let submitting = $state(false);
	const delivery = $derived(
		[
			[t('shop.order.recipient'), order.recipientName],
			[t('shop.order.phone'), order.phone],
			[t('shop.order.city'), order.city],
			[t('shop.order.address'), order.address],
			[t('cabinet.orders.comment'), order.comment],
			[t('shop.order.tracking'), order.trackingNote]
		].filter((row): row is [string, string] => !!row[1])
	);
	const box = 'flex flex-col gap-3 rounded-md border border-line bg-surface p-5';
</script>

<svelte:head>
	<title>{t('shop.order.title', { number: order.number })} — {t('site.name')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<article class="flex max-w-2xl flex-col gap-6">
	<a
		class="text-sm font-bold text-navy-700 underline hover:no-underline"
		href={localizePath('/cabinet/orders', currentLocale())}>{t('shop.order.back')}</a
	>
	<div class="flex flex-col gap-2">
		<div class="flex flex-wrap items-center gap-3">
			<h1 class="text-3xl font-bold text-ink-900">
				{t('shop.order.title', { number: order.number })}
			</h1>
			<OrderStatusBadge status={order.status} />
		</div>
		<p class="text-sm text-ink-500">
			{t('shop.order.placed', { date: newsDate(order.createdAt, currentLocale()) })}
		</p>
	</div>

	{#if form && 'cancelled' in form}
		<p role="status" class="rounded-md bg-success-bg p-3 text-sm text-success-fg">
			{t('cabinet.orders.cancelled', { points: order.totalPoints })}
		</p>
	{:else if form && 'cancelLate' in form}
		<p role="alert" class="rounded-md bg-error-bg p-3 text-sm text-error-fg">
			{t('cabinet.orders.cancelLate')}
		</p>
	{/if}

	<section class={box} aria-labelledby="order-lines">
		<h2 id="order-lines" class="text-lg font-bold text-ink-900">{t('shop.order.lines')}</h2>
		<ul class="flex flex-col gap-2">
			{#each order.lines as line, i (i)}
				<li class="flex flex-wrap justify-between gap-2 border-b border-line pb-2">
					<span>
						<span class="font-bold text-ink-900">{pickLocalized(line.title, currentLocale())}</span>
						{#if line.selectedOptions}
							<span class="block text-sm text-ink-700">{optionsText(line.selectedOptions)}</span>
						{/if}
					</span>
					<span class="text-sm whitespace-nowrap">
						{t('shop.order.linePrice', {
							points: line.pricePointsSnapshot,
							quantity: line.quantity
						})}
					</span>
				</li>
			{/each}
		</ul>
		<p class="font-bold text-ink-900">{t('shop.order.total', { points: order.totalPoints })}</p>
	</section>

	<section class={box} aria-labelledby="order-delivery">
		<h2 id="order-delivery" class="text-lg font-bold text-ink-900">{t('shop.order.delivery')}</h2>
		<dl class="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
			{#each delivery as [label, value] (label)}
				<dt class="text-sm font-bold text-ink-700">{label}</dt>
				<dd class="break-words whitespace-pre-line text-ink-900">{value}</dd>
			{/each}
		</dl>
	</section>

	{#if order.canCancel}
		<form
			method="POST"
			action="?/cancel"
			class="flex flex-col items-start gap-2"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update();
					submitting = false;
				};
			}}
		>
			<p class="text-sm text-ink-700">{t('cabinet.orders.cancelHint')}</p>
			<Button type="submit" variant="secondary" loading={submitting}>
				{t('cabinet.orders.cancel')}
			</Button>
		</form>
	{/if}
</article>
