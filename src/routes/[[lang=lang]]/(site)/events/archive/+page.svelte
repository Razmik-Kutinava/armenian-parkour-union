<script lang="ts">
	import EventCard from '#lib/components/site/EventCard.svelte';
	import EventPager from '#lib/components/site/EventPager.svelte';
	import SeoHead from '#lib/components/site/SeoHead.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { localizePath } from '#lib/i18n/locales.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const list = $derived(localizePath('/events/archive', currentLocale()));
</script>

<SeoHead seo={data.seo} />

<div class="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:py-14">
	<div class="flex flex-wrap items-baseline justify-between gap-3">
		<h1 class="text-3xl font-bold text-ink-900 sm:text-4xl">{t('events.archive.title')}</h1>
		<a
			class="font-bold text-navy-700 underline-offset-2 hover:underline"
			href={localizePath('/events', currentLocale())}>{t('events.all')}</a
		>
	</div>
	{#if data.events.length === 0}
		<p class="text-ink-700">{t('events.archive.empty')}</p>
	{:else}
		<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.events as event (event.slug)}<EventCard {event} showWindow={false} />{/each}
		</div>
	{/if}
	<EventPager
		page={data.page}
		pages={data.pages}
		href={(page) => (page > 1 ? `${list}?page=${page}` : list)}
	/>
</div>
