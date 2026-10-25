<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import ConsentItem from './ConsentItem.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{t('consents.title')} — {t('site.name')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex max-w-3xl flex-col gap-6">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-bold text-ink-900">{t('consents.title')}</h1>
		<p class="text-ink-700">
			{t(data.consents.minor ? 'consents.hint.minor' : 'consents.hint.adult')}
		</p>
		<p class="text-sm text-ink-700">{t('consents.intro')}</p>
	</div>
	{#each data.consents.items as item (item.kind)}
		<ConsentItem {item} />
	{/each}
</div>
