<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';

	/* Pages of "Site settings" (docs/05 section 21); the admin menu keeps one entry. */
	let { current }: { current: 'site' | 'payments' | 'videos' | 'certificates' | 'languages' } =
		$props();
	const tabs = [
		{ id: 'site', href: '/admin/settings', label: 'settings.tab.site' },
		{ id: 'payments', href: '/admin/settings/payments', label: 'settings.tab.payments' },
		{ id: 'videos', href: '/admin/settings/videos', label: 'settings.tab.videos' },
		{
			id: 'certificates',
			href: '/admin/settings/certificates',
			label: 'settings.tab.certificates'
		},
		{ id: 'languages', href: '/admin/settings/languages', label: 'settings.tab.languages' }
	] as const;
</script>

<!-- The base line is an inset shadow: a tab's own border covers it without overflowing the list. -->
<nav
	aria-label={t('settings.tabs')}
	class="mb-6 flex gap-2 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--color-line)]"
>
	{#each tabs as tab (tab.id)}
		<a
			href={tab.href}
			aria-current={tab.id === current ? 'page' : undefined}
			class="inline-flex min-h-11 items-center border-b-2 px-3 font-bold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 sm:min-h-10 {tab.id ===
			current
				? 'border-navy-700 text-navy-700'
				: 'border-transparent text-ink-700 hover:text-navy-700'}"
		>
			{t(tab.label)}
		</a>
	{/each}
</nav>
