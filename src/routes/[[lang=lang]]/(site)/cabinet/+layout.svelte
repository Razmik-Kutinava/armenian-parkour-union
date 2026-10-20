<script lang="ts">
	import { page } from '$app/state';
	import { currentLocale, localizePath, t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	/* docs/06 section 5: only the sections that exist; events, progress, points and the rest come
	 * with stages 4–7. On a phone the menu scrolls sideways above the page. */
	const sections: [MessageKey, string][] = [
		['cabinet.nav.overview', '/cabinet'],
		['cabinet.nav.profile', '/cabinet/profile'],
		['cabinet.nav.membership', '/cabinet/membership'],
		['cabinet.nav.payments', '/cabinet/payments']
	];
	const current = (path: string) => {
		const here = localizePath(page.url.pathname, 'en');
		return path === '/cabinet' ? here === path : here === path || here.startsWith(`${path}/`);
	};
</script>

<div class="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:py-10 lg:flex-row lg:gap-10">
	<nav aria-label={t('cabinet.nav.label')} class="shrink-0 lg:w-52">
		<ul class="flex gap-1 overflow-x-auto lg:flex-col">
			{#each sections as [key, path] (path)}
				<li>
					<a
						href={localizePath(path, currentLocale())}
						aria-current={current(path) ? 'page' : undefined}
						class="flex min-h-11 items-center rounded-md px-3 font-bold whitespace-nowrap text-ink-700 hover:bg-navy-100 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 aria-[current=page]:bg-navy-900 aria-[current=page]:text-surface"
					>
						{t(key)}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
	<div class="min-w-0 flex-1">{@render children()}</div>
</div>
