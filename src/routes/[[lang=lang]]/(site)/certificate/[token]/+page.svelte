<script lang="ts">
	import { newsDate } from '#lib/components/site/news-date.ts';
	import Badge from '#lib/components/ui/Badge.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const c = $derived(data.certificate);
	const day = (date: Date) => newsDate(date, currentLocale());
	const tones = { active: 'success', expired: 'warning', revoked: 'error' } as const;
</script>

<svelte:head>
	<title>{t('certificates.verify.title')} — {t('site.name')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<article class="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:py-14">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<h1 class="text-3xl font-bold text-ink-900 sm:text-4xl">{t('certificates.verify.title')}</h1>
		<span role="status"
			><Badge tone={tones[c.state]}>{t(`certificates.verify.state.${c.state}`)}</Badge></span
		>
	</div>

	<dl
		class="grid gap-x-6 gap-y-3 rounded-md border border-line bg-surface p-5 sm:grid-cols-[auto_1fr]"
	>
		<dt class="font-bold text-ink-700">{t('certificates.verify.holder')}</dt>
		<dd class="text-lg font-bold text-ink-900">{c.holder}</dd>
		<dt class="font-bold text-ink-700">{t('certificates.verify.kind')}</dt>
		<dd class="text-ink-900">{t(data.title)}</dd>
		{#if c.category}
			<dt class="font-bold text-ink-700">{t('certificates.pdf.category')}</dt>
			<dd class="text-ink-900">{c.category}</dd>
		{/if}
		<dt class="font-bold text-ink-700">{t('certificates.pdf.number')}</dt>
		<dd class="font-mono text-ink-900">{c.number}</dd>
		<dt class="font-bold text-ink-700">{t('certificates.pdf.issued')}</dt>
		<dd class="text-ink-900">{day(c.issuedAt)}</dd>
		{#if c.expiresAt}
			<dt class="font-bold text-ink-700">{t('certificates.pdf.valid_until')}</dt>
			<dd class="text-ink-900">{day(c.expiresAt)}</dd>
		{/if}
	</dl>
</article>
