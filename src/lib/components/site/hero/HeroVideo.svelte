<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import { youtubeEmbedUrl, youtubeThumbUrl } from './youtube';

	/* decisions.md 2026-10-08 (2.6): a picture with a button; the player loads only on click. */
	let { id, title }: { id: string; title: string } = $props();
	let playing = $state(false);
</script>

<div class="relative aspect-video w-full overflow-hidden rounded-lg bg-navy-900 shadow-lg">
	{#if playing}
		<iframe
			class="absolute inset-0 size-full"
			src={youtubeEmbedUrl(id)}
			{title}
			allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
			allowfullscreen
		></iframe>
	{:else}
		<button
			type="button"
			class="group absolute inset-0 size-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
			aria-label={t('hero.playVideo')}
			onclick={() => (playing = true)}
		>
			<img
				src={youtubeThumbUrl(id)}
				alt=""
				loading="lazy"
				width="480"
				height="360"
				class="size-full object-cover transition duration-300 group-hover:scale-105"
			/>
			<span class="absolute inset-0 bg-navy-950/40 transition group-hover:bg-navy-950/20"></span>
			<span
				class="absolute top-1/2 left-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent-500 shadow-lg transition group-hover:scale-110"
			>
				<svg viewBox="0 0 24 24" class="ml-1 size-8 fill-navy-950" aria-hidden="true">
					<path d="M8 5v14l11-7z" />
				</svg>
			</span>
		</button>
	{/if}
</div>
