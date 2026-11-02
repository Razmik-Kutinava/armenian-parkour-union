<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { PageProps } from './$types';

	/* docs/06 section 4.13: a form without JavaScript; failures share one text without details. */
	let { data, form }: PageProps = $props();
	const invite = $derived(form?.invalid ? null : data.invite);
</script>

<svelte:head>
	<title>{t('volunteerCashier.join.title')} — {t('site.name')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<article class="mx-auto flex max-w-xl flex-col gap-4 px-4 py-10 sm:py-14">
	<h1 class="text-3xl font-bold text-ink-900">{t('volunteerCashier.join.title')}</h1>
	{#if invite}
		<p class="text-ink-900">
			{t('volunteerCashier.join.text', { partner: invite.partnerName, label: invite.label })}
		</p>
		<p class="text-sm text-ink-700">{t('volunteerCashier.join.browser')}</p>
		<form method="POST">
			<Button type="submit">{t('volunteerCashier.join.bind')}</Button>
		</form>
	{:else}
		<p role="alert" class="text-ink-900">{t('volunteerCashier.join.invalid')}</p>
	{/if}
</article>
