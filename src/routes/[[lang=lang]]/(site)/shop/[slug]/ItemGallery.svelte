<script lang="ts">
	import { mediaPhoto, mediaThumb } from '#lib/components/site/media-photo.ts';
	import { t } from '#lib/i18n/index.svelte.ts';

	/* docs/06 section 4.7: the photos in the editor's order; thumbnails switch the big one. */
	let { images }: { images: { url: string; alt: string }[] } = $props();
	let shown = $state(0);
	const current = $derived(images[Math.min(shown, images.length - 1)]);
</script>

<section class="flex flex-col gap-3" aria-label={t('shop.gallery')}>
	<div
		class="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-navy-100"
	>
		{#if current}
			<img
				{...mediaPhoto(current.url)}
				sizes="(min-width: 64rem) 30rem, (min-width: 48rem) 50vw, 100vw"
				alt={current.alt}
				width="800"
				height="800"
				class="size-full object-cover"
			/>
		{:else}
			<span class="text-ink-700">{t('shop.noPhoto')}</span>
		{/if}
	</div>
	{#if images.length > 1}
		<ul class="flex flex-wrap gap-2">
			{#each images as image, i (image.url)}
				<li>
					<button
						type="button"
						class="size-16 overflow-hidden rounded-md border-2 {i === shown
							? 'border-navy-700'
							: 'border-transparent'}"
						aria-label={t('shop.photo', { n: i + 1 })}
						aria-pressed={i === shown}
						onclick={() => (shown = i)}
					>
						<img
							src={mediaThumb(image.url, 160)}
							alt=""
							width="64"
							height="64"
							class="size-full object-cover"
						/>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</section>
