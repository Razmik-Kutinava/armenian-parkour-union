<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Pause from '@lucide/svelte/icons/pause';
	import Play from '@lucide/svelte/icons/play';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { HeroSlideView } from '#lib/server/services/hero/view.ts';
	import HeroBlock from './HeroBlock.svelte';

	/*
	 * docs/08: slides change by themselves only without `prefers-reduced-motion`, stop on hover,
	 * focus or the pause button (WCAG 2.2.2). 16:9 on wide screens, 4:5 on phones, diagonal cut.
	 */
	type Props = { slides: HeroSlideView[]; level?: 1 | 2 };
	let { slides, level = 1 }: Props = $props();

	const INTERVAL_MS = 8000;
	let current = $state(0);
	let paused = $state(false);
	let held = $state(false);
	const many = $derived(slides.length > 1);
	const go = (n: number) => (current = (n + slides.length) % slides.length);

	$effect(() => {
		if (!many || paused || held) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const timer = setInterval(() => go(current + 1), INTERVAL_MS);
		return () => clearInterval(timer);
	});
</script>

<section
	aria-label={t('hero.region')}
	aria-roledescription="carousel"
	class="relative bg-navy-950"
	style="clip-path: polygon(0 0, 100% 0, 100% calc(100% - 3rem), 0 100%)"
	onmouseenter={() => (held = true)}
	onmouseleave={() => (held = false)}
	onfocusin={() => (held = true)}
	onfocusout={() => (held = false)}
>
	<div class="grid">
		{#each slides as slide, i (slide.id ?? `fallback-${i}`)}
			<div
				class="col-start-1 row-start-1 aspect-[4/5] w-full sm:aspect-video sm:max-h-[85vh]"
				role="group"
				aria-roledescription="slide"
				aria-label="{i + 1} / {slides.length}"
				hidden={i !== current ? true : undefined}
			>
				<HeroBlock {slide} level={i === 0 ? level : 2} eager={i === 0} />
			</div>
		{/each}
	</div>
	{#if many}
		<div
			class="absolute right-0 bottom-14 left-0 mx-auto flex max-w-page items-center gap-2 px-6 md:px-12"
		>
			<button
				type="button"
				class="rounded-full p-2 text-surface hover:bg-navy-800"
				aria-label={t('hero.prev')}
				onclick={() => go(current - 1)}><ChevronLeft class="size-5" aria-hidden="true" /></button
			>
			<ul class="flex gap-2" aria-label={t('hero.slides')}>
				{#each slides as slide, i (slide.id ?? `dot-${i}`)}
					<li>
						<button
							type="button"
							class="block h-2 rounded-full transition-all {i === current
								? 'w-8 bg-accent-500'
								: 'w-2 bg-navy-300'}"
							aria-label={t('hero.goTo', { n: i + 1 })}
							aria-current={i === current || undefined}
							onclick={() => go(i)}
						></button>
					</li>
				{/each}
			</ul>
			<button
				type="button"
				class="rounded-full p-2 text-surface hover:bg-navy-800"
				aria-label={t('hero.next')}
				onclick={() => go(current + 1)}><ChevronRight class="size-5" aria-hidden="true" /></button
			>
			<button
				type="button"
				class="rounded-full p-2 text-surface hover:bg-navy-800"
				aria-label={paused ? t('hero.play') : t('hero.pause')}
				onclick={() => (paused = !paused)}
			>
				{#if paused}<Play class="size-5" aria-hidden="true" />{:else}<Pause
						class="size-5"
						aria-hidden="true"
					/>{/if}
			</button>
		</div>
	{/if}
</section>
