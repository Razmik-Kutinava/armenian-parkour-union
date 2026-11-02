<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{t('volunteerCashier.partner.title')} — {t('site.name')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<article class="mx-auto flex max-w-xl flex-col gap-4 px-4 py-10 sm:py-14">
	<h1 class="text-3xl font-bold text-ink-900">{t('volunteerCashier.partner.title')}</h1>
	{#if data.cashier}
		<p role="status" class="text-lg font-bold text-ink-900">
			{t('volunteerCashier.partner.bound', {
				partner: data.cashier.partnerName,
				label: data.cashier.label
			})}
		</p>
		<p class="text-ink-700">{t('volunteerCashier.partner.hint')}</p>
	{:else}
		<p role="status" class="text-lg font-bold text-ink-900">
			{t('volunteerCashier.partner.unbound')}
		</p>
		<p class="text-ink-700">{t('volunteerCashier.partner.unboundHint')}</p>
	{/if}
</article>
