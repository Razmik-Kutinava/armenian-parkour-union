<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';

	const videoId = 'kMpYHcuipuY';
	const thumbs = `https://i.ytimg.com/vi_webp/${videoId}`;
	let playing = $state(false);
</script>

<section class="bg-navy-950 text-surface">
	<div class="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-16 md:py-20">
		<p class="text-sm font-bold tracking-widest text-accent-500 uppercase">
			{t('fest.videoKicker')}
		</p>
		<h2 class="text-3xl font-bold md:text-4xl">{t('fest.videoTitle')}</h2>
		<p class="max-w-3xl text-lg text-navy-100">{t('fest.videoText')}</p>
		<div class="shadow-2xl relative aspect-video w-full overflow-hidden rounded-lg bg-navy-900">
			{#if playing}
				<iframe
					class="absolute inset-0 h-full w-full"
					src="https://www.youtube-nocookie.com/embed/{videoId}?autoplay=1&rel=0"
					title={t('fest.videoCaption')}
					allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
					allowfullscreen
				></iframe>
			{:else}
				<button
					type="button"
					class="group absolute inset-0 h-full w-full cursor-pointer"
					aria-label={t('fest.videoPlay')}
					onclick={() => (playing = true)}
				>
					<img
						src="{thumbs}/maxresdefault.webp"
						srcset="{thumbs}/hqdefault.webp 480w, {thumbs}/sddefault.webp 640w, {thumbs}/maxresdefault.webp 1280w"
						sizes="(min-width: 64rem) 61rem, 100vw"
						alt=""
						width="1280"
						height="720"
						loading="lazy"
						class="h-full w-full object-cover transition duration-300 group-hover:scale-105"
					/>
					<span class="absolute inset-0 bg-navy-950/40 transition group-hover:bg-navy-950/20"
					></span>
					<span
						class="shadow-xl absolute top-1/2 left-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent-500 transition group-hover:scale-110"
					>
						<svg viewBox="0 0 24 24" class="ml-1 h-9 w-9 fill-navy-950" aria-hidden="true">
							<path d="M8 5v14l11-7z" />
						</svg>
					</span>
				</button>
			{/if}
		</div>
		<p class="text-sm text-navy-300">{t('fest.videoCaption')}</p>
	</div>
</section>
