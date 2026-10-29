<script lang="ts">
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { localizePath } from '#lib/i18n/locales.ts';
	import type { HeroSlideView } from '#lib/server/services/hero/view.ts';
	import { eventDates } from '../event-date';
	import { mediaThumb } from '../media-photo';
	import { coverOrPlaceholder } from '../placeholder-photo';
	import HeroVideo from './HeroVideo.svelte';

	/*
	 * docs/08: one frame for every type — background, navy shade, title, subtitle, one button.
	 * Without a picture — a placeholder photo. The first slide is the page heading and loads its image eagerly.
	 */
	type Props = { slide: HeroSlideView; level?: 1 | 2; eager?: boolean };
	let { slide, level = 1, eager = false }: Props = $props();

	const locale = $derived(currentLocale());
	const banner = $derived(slide.type === 'banner');
	const title = $derived(banner ? t('hero.banner.title') : slide.title);
	const subtitle = $derived(banner ? t('hero.banner.subtitle') : slide.subtitle);
	const cta = $derived.by(() => {
		if (slide.cta) return slide.cta;
		if (slide.event) return { label: t('hero.eventCta'), url: `/events/${slide.event.slug}` };
		if (banner) return { label: t('hero.banner.cta'), url: '/register' };
		return null;
	});
	const external = (url: string) => /^https?:\/\//.test(url);
	const href = (url: string) => (external(url) ? url : localizePath(url, locale));
	const youtube = $derived(slide.video?.kind === 'youtube' ? slide.video.id : null);
	const instagram = $derived(slide.video?.kind === 'instagram' ? slide.video.url : null);
	const photo = $derived(coverOrPlaceholder(slide.mediaUrl, slide.id ?? title));
</script>

<div class="relative isolate flex h-full items-center overflow-hidden bg-navy-950 text-surface">
	<img
		src={photo.src}
		srcset={photo.srcset}
		sizes="100vw"
		alt=""
		width="1600"
		height="900"
		loading={eager ? 'eager' : 'lazy'}
		fetchpriority={eager ? 'high' : 'auto'}
		class="absolute inset-0 -z-10 size-full object-cover"
	/>
	<div
		class="absolute inset-0 -z-10 bg-gradient-to-r from-navy-950/95 via-navy-950/75 to-navy-950/30"
	></div>
	<div
		class="mx-auto grid w-full max-w-page items-center gap-8 px-6 pt-14 pb-24 md:px-12 {youtube
			? 'md:grid-cols-2'
			: ''}"
	>
		<div class="flex max-w-2xl flex-col gap-4">
			{#if slide.event}
				<p class="text-sm font-bold tracking-widest text-accent-500 uppercase">
					<time datetime={slide.event.startsAt.toISOString()}
						>{eventDates(slide.event.startsAt, slide.event.endsAt, locale)}</time
					>{#if slide.event.city}&nbsp;· {slide.event.city}{/if}
				</p>
			{:else if slide.person}
				<p class="flex items-center gap-3 font-bold text-accent-500">
					{#if slide.person.avatarUrl}
						<img
							src={mediaThumb(slide.person.avatarUrl, 160)}
							alt=""
							width="56"
							height="56"
							class="size-14 rounded-full border-2 border-accent-500 object-cover"
						/>
					{/if}
					{slide.person.name}
				</p>
			{/if}
			<svelte:element this={level === 1 ? 'h1' : 'h2'} class="text-4xl font-bold md:text-5xl">
				{title}
			</svelte:element>
			{#if subtitle}<p class="text-lg text-navy-100 md:text-xl">{subtitle}</p>{/if}
			{#if cta || instagram}
				<div class="flex flex-wrap gap-3 pt-2">
					{#if cta}
						<a
							href={href(cta.url)}
							rel={external(cta.url) ? 'noopener' : undefined}
							class="inline-flex min-h-11 items-center rounded-md bg-accent-500 px-6 font-bold text-navy-950 hover:bg-accent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
							>{cta.label}</a
						>
					{/if}
					{#if instagram}
						<a
							href={instagram}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex min-h-11 items-center rounded-md border border-navy-300 px-6 font-bold text-navy-100 hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
							>{t('hero.instagram')}</a
						>
					{/if}
				</div>
			{/if}
		</div>
		{#if youtube}<HeroVideo id={youtube} {title} />{/if}
	</div>
</div>
