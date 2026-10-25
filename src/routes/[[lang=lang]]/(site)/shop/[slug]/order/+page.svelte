<script lang="ts">
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { localizePath } from '#lib/i18n/locales.ts';
	import DeliveryForm from './DeliveryForm.svelte';
	import OrderConfirm from './OrderConfirm.svelte';
	import type { PageProps } from './$types';

	/* docs/06 section 4.7: delivery form → confirmation → "placed". The button state is read again
	 * on each step: out of stock or too few points shows the reason instead of the form. */
	let { data, form }: PageProps = $props();
	const href = (path: string) => localizePath(path, currentLocale());
	const placed = $derived(form && 'placed' in form ? form.placed : null);
	const confirm = $derived(form && 'confirm' in form ? form.confirm : null);
	const values = $derived((form && 'values' in form ? form.values : null) ?? {});
	const chosen = $derived((form && 'options' in form ? form.options : null) ?? data.chosen);
	const errors = $derived((form && 'errors' in form ? form.errors : null) ?? {});
	const changed = $derived(!!form && 'changed' in form);
	const button = $derived(data.button);
	const reason = $derived(
		button.state === 'out_of_stock'
			? t('shop.outOfStock')
			: button.state === 'short'
				? t('shop.button.short', { points: button.missing })
				: button.state === 'email_unverified'
					? t('shop.button.emailUnverified')
					: t('shop.checkout.unavailable')
	);
	const link = 'font-bold text-navy-700 underline-offset-2 hover:underline';
</script>

<svelte:head>
	<title>{t('shop.checkout.title')} — {data.item.title}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:py-14">
	<a class="text-sm {link}" href={href(`/shop/${data.item.slug}`)}>← {data.item.title}</a>
	<div class="flex flex-col gap-1">
		<h1 class="text-3xl font-bold text-ink-900">{t('shop.checkout.title')}</h1>
		<p class="text-lg font-bold text-navy-900">
			{data.item.title} · {t('shop.points', { points: data.item.pricePoints })}
		</p>
	</div>

	{#if placed}
		<section role="status" class="flex flex-col gap-3 rounded-md bg-success-bg p-4 text-success-fg">
			<h2 class="text-xl font-bold">{t('shop.checkout.placed', { number: placed.number })}</h2>
			<p>{t('shop.checkout.placedText', { points: placed.points })}</p>
			<div class="flex flex-wrap gap-4">
				<a class={link} href={href('/cabinet/orders')}>{t('shop.checkout.myOrders')}</a>
				<a class={link} href={href('/shop')}>{t('shop.back')}</a>
			</div>
		</section>
	{:else}
		{#if changed}
			<p role="alert" class="rounded-md bg-error-bg p-3 text-sm text-error-fg">
				{t('shop.checkout.error.changed')}
			</p>
		{/if}
		{#if button.state !== 'can_order'}
			<p class="text-ink-900">{reason}</p>
			{#if button.state === 'email_unverified'}
				<a class="text-sm {link}" href={href('/cabinet')}>{t('shop.button.emailLink')}</a>
			{/if}
		{:else if confirm}
			<OrderConfirm title={data.item.title} {confirm} />
		{:else}
			<DeliveryForm itemOptions={data.item.options} {chosen} {values} {errors} />
		{/if}
	{/if}
</div>
