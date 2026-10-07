<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { page } from '$app/state';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { NavGroup } from '#lib/server/admin/nav.ts';
	import { breadcrumbs } from './breadcrumbs';

	let { nav }: { nav: NavGroup[] } = $props();
	const crumbs = $derived(breadcrumbs(nav, page.url.pathname));
</script>

<nav aria-label={t('admin.breadcrumbs')} class="min-w-0">
	<ol class="flex items-center gap-1 text-sm">
		{#each crumbs as crumb, i (crumb.href)}
			{@const last = i === crumbs.length - 1}
			<li class="flex min-w-0 items-center gap-1">
				{#if i > 0}<ChevronRight class="size-4 shrink-0 text-ink-500" aria-hidden="true" />{/if}
				{#if last}
					<span aria-current="page" class="truncate font-bold text-ink-900">{t(crumb.key)}</span>
				{:else}
					<a
						href={crumb.href}
						class="truncate rounded-sm text-ink-700 hover:text-navy-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600"
						>{t(crumb.key)}</a
					>
				{/if}
			</li>
		{/each}
	</ol>
</nav>
