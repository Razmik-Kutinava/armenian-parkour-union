<script lang="ts">
	import Menu from '@lucide/svelte/icons/menu';
	import { currentLocale, localizePath, t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import AccountLinks, { type Viewer } from './AccountLinks.svelte';
	import Disclosure from './Disclosure.svelte';
	import LanguageSwitcher from './LanguageSwitcher.svelte';

	let { viewer }: { viewer: Viewer | null } = $props();

	/* docs/06 section 2. Pages appear in stages 2–7; until then the links lead to 404 (decisions, 1.8). */
	const menu: [MessageKey, string][] = [
		['nav.events', '/events'],
		['nav.news', '/news'],
		['nav.federation', '/federation'],
		['nav.shop', '/shop'],
		['nav.donate', '/donate']
	];
	const href = (path: string) => localizePath(path, currentLocale());
	const initials = $derived(
		(viewer?.name ?? '')
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0]?.toUpperCase())
			.join('')
	);
	const link =
		'flex min-h-11 items-center rounded-sm px-3 font-bold text-navy-100 hover:text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500';
	const panel = 'absolute top-full right-0 z-40 mt-2 rounded-md bg-navy-900 p-2 shadow-lg';
</script>

{#snippet menuLinks(vertical: boolean)}
	<ul class={vertical ? 'flex flex-col gap-1' : 'flex items-center gap-1'}>
		{#each menu as [key, path] (path)}
			<li><a class={link} href={href(path)}>{t(key)}</a></li>
		{/each}
	</ul>
{/snippet}

{#snippet guestLinks()}
	<a class={link} href={href('/login')}>{t('nav.login')}</a>
	<a
		class="flex min-h-11 items-center rounded-md bg-accent-500 px-4 font-bold text-navy-950 hover:bg-accent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
		href={href('/join')}>{t('nav.join')}</a
	>
{/snippet}

<header class="relative bg-navy-900 text-surface">
	<div class="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2">
		<a
			href={href('/')}
			class="mr-auto rounded-sm py-2 text-lg font-bold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 lg:mr-4"
		>
			{t('site.name')}
		</a>

		<nav aria-label={t('nav.main')} class="hidden lg:mr-auto lg:block">
			{@render menuLinks(false)}
		</nav>

		<div class="hidden items-center gap-2 lg:flex">
			<LanguageSwitcher />
			{#if viewer}
				<Disclosure summaryClass="text-navy-100 hover:text-surface">
					{#snippet summary()}
						<span
							class="flex size-8 items-center justify-center rounded-full bg-navy-100 text-sm text-navy-900"
							aria-hidden="true">{initials}</span
						>
						{viewer.name}
					{/snippet}
					<div class="{panel} w-56">
						<AccountLinks isStaff={viewer.isStaff} />
					</div>
				</Disclosure>
			{:else}
				{@render guestLinks()}
			{/if}
		</div>

		<Disclosure class="lg:hidden" summaryClass="text-navy-100 hover:text-surface">
			{#snippet summary()}
				<Menu class="size-5" aria-hidden="true" />
				{t('nav.menu')}
			{/snippet}
			<div class="{panel} flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-3">
				<nav aria-label={t('nav.main')}>{@render menuLinks(true)}</nav>
				<LanguageSwitcher />
				{#if viewer}
					<AccountLinks isStaff={viewer.isStaff} />
				{:else}
					<div class="flex flex-col gap-2">{@render guestLinks()}</div>
				{/if}
			</div>
		</Disclosure>
	</div>
</header>
