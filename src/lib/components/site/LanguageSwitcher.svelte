<script lang="ts">
	import { page } from '$app/state';
	import {
		currentLocale,
		localeNames,
		localizePath,
		locales,
		t,
		type Locale
	} from '#lib/i18n/index.svelte.ts';

	/* landmark: false — a repeat of the header switcher (footer): a labelled group, not a second
	 * "Language" navigation landmark for screen readers. */
	/* short — codes for the desktop header row, where full names do not fit (hy is the widest). */
	let {
		surface = 'dark',
		landmark = true,
		short = false
	}: { surface?: 'light' | 'dark'; landmark?: boolean; short?: boolean } = $props();

	/* Enabled languages from the site layout (site settings); all three where it did not load. */
	const shown = $derived<readonly Locale[]>(page.data.locales ?? locales);

	const tone = $derived(
		surface === 'dark'
			? 'text-navy-300 hover:text-surface aria-[current=true]:text-accent-500 focus-visible:outline-accent-500'
			: 'text-ink-700 hover:text-navy-700 aria-[current=true]:text-navy-700 focus-visible:outline-navy-600'
	);
</script>

{#if shown.length > 1}
	<svelte:element
		this={landmark ? 'nav' : 'div'}
		role={landmark ? undefined : 'group'}
		aria-label={t('nav.language')}
	>
		<ul class="flex gap-1">
			{#each shown as locale (locale)}
				<li>
					<a
						href={localizePath(page.url.pathname, locale) + page.url.search}
						hreflang={locale}
						lang={locale}
						aria-current={locale === currentLocale() ? 'true' : undefined}
						aria-label={short ? localeNames[locale] : undefined}
						title={short ? localeNames[locale] : undefined}
						class="inline-flex min-h-11 items-center rounded-sm px-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 aria-[current=true]:underline aria-[current=true]:underline-offset-4 {tone}"
					>
						{short ? locale.toUpperCase() : localeNames[locale]}
					</a>
				</li>
			{/each}
		</ul>
	</svelte:element>
{/if}
