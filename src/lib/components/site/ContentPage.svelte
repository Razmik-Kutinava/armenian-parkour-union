<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { PublicPage } from '#lib/server/services/pages/public.ts';

	/* docs/06 section 4.5: a page from `pages`. The HTML was cleaned on save (server/rich-text). */
	let { page, children }: { page: PublicPage; children?: Snippet } = $props();
</script>

<svelte:head><title>{page.title} — {t('site.name')}</title></svelte:head>

<article class="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:py-14">
	<h1 class="text-3xl font-bold text-ink-900 sm:text-4xl">{page.title}</h1>
	{#if page.html}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<div class="rich-text">{@html page.html}</div>
	{/if}
	{@render children?.()}
</article>
