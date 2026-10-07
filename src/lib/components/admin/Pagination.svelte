<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { page } from '$app/state';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { listHref, pageCount } from './list-state';

	let { total, current }: { total: number; current: number } = $props();

	const pages = $derived(pageCount(total));
	const href = (n: number) =>
		listHref(page.url.pathname, page.url.searchParams, { page: n > 1 ? String(n) : null });
	const link =
		'inline-flex min-h-11 items-center gap-1 rounded-md px-3 text-sm font-bold text-navy-700 hover:bg-navy-50 focus-visible:outline-2 focus-visible:outline-navy-600';
</script>

{#if pages > 1}
	<nav aria-label={t('table.pagination')} class="flex items-center justify-between gap-2 pt-4">
		{#if current > 1}
			<a class={link} href={href(current - 1)} rel="prev"
				><ChevronLeft class="size-4" aria-hidden="true" />{t('table.prev')}</a
			>
		{:else}
			<span></span>
		{/if}
		<span class="text-sm text-ink-700">{t('table.pageOf', { page: current, pages })}</span>
		{#if current < pages}
			<a class={link} href={href(current + 1)} rel="next"
				>{t('table.next')}<ChevronRight class="size-4" aria-hidden="true" /></a
			>
		{:else}
			<span></span>
		{/if}
	</nav>
{/if}
