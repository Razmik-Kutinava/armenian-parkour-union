<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
</script>

<svelte:head>
	<title>{t('site.name')}</title>
</svelte:head>

<main class="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
	<h1 class="text-3xl font-bold">{t('site.name')}</h1>
	<p>{t('site.underConstruction')}</p>
</main>
