<script lang="ts">
	import Menu from '@lucide/svelte/icons/menu';
	import X from '@lucide/svelte/icons/x';
	import { page } from '$app/state';
	import { currentLocale, localeNames, locales, t } from '#lib/i18n/index.svelte.ts';
	import type { NavGroup } from '#lib/server/admin/nav.ts';
	import type { UserRole } from '#lib/server/auth/session.ts';
	import Disclosure from '../site/Disclosure.svelte';
	import Breadcrumbs from './Breadcrumbs.svelte';

	let {
		staff,
		nav,
		menuOpen = $bindable(false)
	}: { staff: { name: string; role: UserRole }; nav: NavGroup[]; menuOpen?: boolean } = $props();

	const item =
		'flex min-h-11 w-full items-center rounded-sm px-3 text-left text-sm font-bold text-ink-900 hover:bg-navy-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600';
</script>

<header
	class="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-surface px-4 py-2 lg:px-8"
>
	<button
		type="button"
		class="flex min-h-11 items-center gap-2 rounded-md px-2 font-bold text-navy-700 hover:bg-navy-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 lg:hidden"
		aria-expanded={menuOpen}
		aria-controls="admin-sidebar"
		onclick={() => (menuOpen = !menuOpen)}
	>
		{#if menuOpen}<X class="size-5" aria-hidden="true" />{:else}<Menu
				class="size-5"
				aria-hidden="true"
			/>{/if}
		{t('nav.menu')}
	</button>

	<div class="min-w-0 flex-1"><Breadcrumbs {nav} /></div>

	<Disclosure summaryClass="text-ink-900 hover:bg-navy-50">
		{#snippet summary()}
			<span class="max-w-40 truncate">{staff.name}</span>
		{/snippet}
		<div
			class="absolute top-full right-0 z-40 mt-2 flex w-60 flex-col gap-2 rounded-md bg-surface p-2 shadow-lg"
		>
			<p class="px-3 pt-1 text-xs text-ink-500">{t(`role.${staff.role}`)}</p>
			<form
				method="POST"
				action="/admin/locale"
				class="flex gap-1 px-1"
				aria-label={t('nav.language')}
			>
				<input type="hidden" name="returnTo" value={page.url.pathname + page.url.search} />
				{#each locales as locale (locale)}
					<button
						name="locale"
						value={locale}
						lang={locale}
						aria-pressed={locale === currentLocale()}
						class="min-h-11 flex-1 rounded-sm px-1 text-sm font-bold text-ink-700 hover:bg-navy-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 aria-pressed:bg-navy-700 aria-pressed:text-surface"
					>
						{localeNames[locale]}
					</button>
				{/each}
			</form>
			<a class={item} href="/" data-sveltekit-reload>{t('admin.toSite')}</a>
			<form method="POST" action="/logout">
				<button type="submit" class={item}>{t('nav.logout')}</button>
			</form>
		</div>
	</Disclosure>
</header>
