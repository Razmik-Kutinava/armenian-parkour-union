<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import CardBlock from './CardBlock.svelte';
	import type { PageProps } from './$types';

	/* docs/06 section 5.12: the "Card" block; perks, uses and invitations come with 10.4–10.8. */
	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>{t('cabinet.volunteer.title')} — {t('site.name')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex max-w-3xl flex-col gap-6">
	<h1 class="text-3xl font-bold text-ink-900">{t('cabinet.volunteer.title')}</h1>
	<CardBlock own={data.own} result={form} />
</div>
