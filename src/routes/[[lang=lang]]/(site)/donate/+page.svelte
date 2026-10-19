<script lang="ts">
	import DonateForm from '#lib/components/site/DonateForm.svelte';
	import DonationList from '#lib/components/site/DonationList.svelte';
	import SeoHead from '#lib/components/site/SeoHead.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<SeoHead seo={data.seo} />

<article class="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:py-14">
	<h1 class="text-3xl font-bold text-ink-900 sm:text-4xl">{t('donate.title')}</h1>
	<p class="text-lg text-ink-700">{t('donate.intro')}</p>
	{#if data.limits}
		<DonateForm limits={data.limits} purposes={data.purposes} donor={data.donor} {form} />
	{:else}
		<p class="rounded-md border border-line bg-surface p-5 text-ink-700">{t('donate.notSet')}</p>
	{/if}
	{#if data.recent.length}
		<DonationList items={data.recent} />
	{/if}
</article>
