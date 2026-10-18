<script lang="ts">
	import EventCard from '#lib/components/site/EventCard.svelte';
	import FestAnnouncement from '#lib/components/site/FestAnnouncement.svelte';
	import HeroSlider from '#lib/components/site/hero/HeroSlider.svelte';
	import HomeJoin from '#lib/components/site/home/HomeJoin.svelte';
	import HomeSection from '#lib/components/site/home/HomeSection.svelte';
	import HomeSteps from '#lib/components/site/home/HomeSteps.svelte';
	import NewsCard from '#lib/components/site/NewsCard.svelte';
	import SeoHead from '#lib/components/site/SeoHead.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { localizePath } from '#lib/i18n/locales.ts';
	import type { PageProps } from './$types';

	/* docs/06 section 4.1, top to bottom; a section without data is not shown. */
	let { data }: PageProps = $props();
	const guest = $derived(!data.viewer);
	const href = (path: string) => localizePath(path, currentLocale());
</script>

<SeoHead seo={data.seo} />
<HeroSlider slides={data.slides} />
<FestAnnouncement />

{#if data.events.length}
	<HomeSection title={t('home.events')} more={{ label: t('home.eventsAll'), path: '/events' }}>
		<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.events as event (event.slug)}<EventCard {event} level={3} />{/each}
		</div>
	</HomeSection>
{/if}

{#if data.about}
	<HomeSection title={t('home.about')}>
		<div class="flex max-w-3xl flex-col items-start gap-4">
			{#if data.about.excerpt}<p class="text-lg text-ink-700">{data.about.excerpt}</p>{/if}
			<div class="flex flex-wrap gap-3">
				<a
					class="inline-flex min-h-11 items-center rounded-md border border-navy-700 px-4 font-bold text-navy-700 hover:bg-navy-100"
					href={href('/federation')}>{t('home.aboutMore')}</a
				>
				{#if guest}
					<a
						class="inline-flex min-h-11 items-center rounded-md bg-navy-700 px-4 font-bold text-surface hover:bg-navy-800"
						href={href('/register')}>{t('home.join')}</a
					>
				{/if}
			</div>
		</div>
	</HomeSection>
{/if}

{#if data.news.length}
	<HomeSection title={t('home.news')} more={{ label: t('home.newsAll'), path: '/news' }}>
		<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.news as post (post.slug)}<NewsCard {post} level={3} />{/each}
		</div>
	</HomeSection>
{/if}

<HomeSteps />

{#if guest}<HomeJoin />{/if}
