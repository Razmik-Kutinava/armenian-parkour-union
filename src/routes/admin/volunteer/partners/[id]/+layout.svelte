<script lang="ts">
	import { page } from '$app/state';
	import { t } from '#lib/i18n/index.svelte.ts';
	import StatusBadge from '../StatusBadge.svelte';
	import type { LayoutProps } from './$types';

	/* docs/05 section 28: partner card tabs (the cashiers tab comes with roadmap 10.6). */
	let { data, children }: LayoutProps = $props();
	const base = $derived(`/admin/volunteer/partners/${data.partner.id}`);
	const tabs = $derived([
		{ href: base, label: t('volunteer.tab.partner') },
		{ href: `${base}/perks`, label: t('volunteer.tab.perks') }
	]);
	const current = $derived(
		[...tabs].reverse().find((tab) => page.url.pathname.startsWith(tab.href))?.href
	);
</script>

<a
	href="/admin/volunteer/partners"
	class="mb-2 inline-block text-sm text-navy-700 underline-offset-2 hover:underline"
	>{t('volunteer.partners.back')}</a
>
<div class="mb-4 flex flex-wrap items-center gap-3">
	<h1 class="text-2xl font-bold">{data.partner.name}</h1>
	<StatusBadge status={data.partner.status} />
</div>

<!-- The base line is an inset shadow: a tab's own border covers it without overflowing the list. -->
<nav
	aria-label={t('volunteer.tabs')}
	class="mb-6 flex gap-2 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--color-line)]"
>
	{#each tabs as tab (tab.href)}
		<a
			href={tab.href}
			aria-current={tab.href === current ? 'page' : undefined}
			class="inline-flex min-h-11 items-center border-b-2 px-3 font-bold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 sm:min-h-10 {tab.href ===
			current
				? 'border-navy-700 text-navy-700'
				: 'border-transparent text-ink-700 hover:text-navy-700'}"
		>
			{tab.label}
		</a>
	{/each}
</nav>

{@render children()}
