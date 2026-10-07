<script lang="ts">
	import { page } from '$app/state';
	import { currentLocale, localeNames, localizePath, locales, t } from '#lib/i18n/index.svelte.ts';

	let { surface = 'dark' }: { surface?: 'light' | 'dark' } = $props();

	const tone = $derived(
		surface === 'dark'
			? 'text-navy-300 hover:text-surface aria-[current=true]:text-accent-500 focus-visible:outline-accent-500'
			: 'text-ink-700 hover:text-navy-700 aria-[current=true]:text-navy-700 focus-visible:outline-navy-600'
	);
</script>

<nav aria-label={t('nav.language')}>
	<ul class="flex gap-1">
		{#each locales as locale (locale)}
			<li>
				<a
					href={localizePath(page.url.pathname, locale) + page.url.search}
					hreflang={locale}
					lang={locale}
					aria-current={locale === currentLocale() ? 'true' : undefined}
					class="inline-flex min-h-11 items-center rounded-sm px-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 aria-[current=true]:underline aria-[current=true]:underline-offset-4 {tone}"
				>
					{localeNames[locale]}
				</a>
			</li>
		{/each}
	</ul>
</nav>
