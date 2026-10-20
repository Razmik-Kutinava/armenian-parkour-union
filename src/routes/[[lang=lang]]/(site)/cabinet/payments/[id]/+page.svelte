<script lang="ts">
	import StatusBadge from '#lib/components/payments/StatusBadge.svelte';
	import { newsDate } from '#lib/components/site/news-date.ts';
	import { currentLocale, localizePath, t } from '#lib/i18n/index.svelte.ts';
	import { formatPrice } from '#lib/money.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const r = $derived(data.receipt);
	const day = (date: Date) => newsDate(date, currentLocale());
	const purpose = $derived(
		r.period
			? `${t('payment.kind.membership')}, ${t('cabinet.receipt.period', { from: day(r.period.startsAt), to: day(r.period.endsAt) })}`
			: (r.purpose ?? t(`payment.kind.${r.kind}`))
	);
</script>

<svelte:head>
	<title>{t('cabinet.receipt.title')} — {t('site.name')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<article class="flex max-w-2xl flex-col gap-6">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<h1 class="text-3xl font-bold text-ink-900">{t('cabinet.receipt.title')}</h1>
		<div class="flex gap-3 print:hidden">
			<a
				class="font-bold text-navy-700 underline hover:no-underline"
				href={localizePath('/cabinet/payments', currentLocale())}>{t('cabinet.receipt.back')}</a
			>
			<button
				type="button"
				class="font-bold text-navy-700 underline hover:no-underline"
				onclick={() => window.print()}>{t('cabinet.receipt.print')}</button
			>
		</div>
	</div>

	<dl
		class="grid gap-x-6 gap-y-3 rounded-md border border-line bg-surface p-5 sm:grid-cols-[auto_1fr]"
	>
		<dt class="font-bold text-ink-700">{t('cabinet.receipt.number')}</dt>
		<dd class="font-mono break-all text-ink-900">{r.id}</dd>
		<dt class="font-bold text-ink-700">{t('cabinet.receipt.paidAt')}</dt>
		<dd class="text-ink-900">{day(r.paidAt)}</dd>
		<dt class="font-bold text-ink-700">{t('cabinet.receipt.amount')}</dt>
		<dd class="text-ink-900">{formatPrice(r.amountMinor, r.currency, currentLocale())}</dd>
		<dt class="font-bold text-ink-700">{t('cabinet.receipt.kind')}</dt>
		<dd class="text-ink-900">{t(`payment.kind.${r.kind}`)}</dd>
		<dt class="font-bold text-ink-700">{t('cabinet.receipt.purpose')}</dt>
		<dd class="text-ink-900">{purpose}</dd>
		<dt class="font-bold text-ink-700">{t('cabinet.receipt.payer')}</dt>
		<dd class="text-ink-900">{r.payerName}</dd>
		<dt class="font-bold text-ink-700">{t('cabinet.receipt.status')}</dt>
		<dd><StatusBadge status={r.status} /></dd>
		{#if r.refundedAt}
			<dt class="font-bold text-ink-700">{t('cabinet.receipt.refundedAt')}</dt>
			<dd class="text-ink-900">{day(r.refundedAt)}</dd>
		{/if}
	</dl>

	{#if r.requisites}
		<section class="flex flex-col gap-2">
			<h2 class="text-lg font-bold text-ink-900">{t('cabinet.receipt.requisites')}</h2>
			<p class="whitespace-pre-line text-ink-700">{r.requisites}</p>
		</section>
	{/if}
</article>
