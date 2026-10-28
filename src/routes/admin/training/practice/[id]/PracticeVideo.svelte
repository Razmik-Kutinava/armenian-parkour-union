<script lang="ts">
	import { parseVideoUrl } from '#lib/components/site/hero/youtube.ts';
	import { t } from '#lib/i18n/index.svelte.ts';

	/* docs/05 section 27 "Practice": YouTube — the youtube-nocookie player, Google Drive — a link. */
	let { url, title }: { url: string; title: string } = $props();
	const video = $derived(parseVideoUrl(url));
</script>

{#if video?.kind === 'youtube'}
	<div class="relative aspect-video w-full overflow-hidden rounded-md bg-navy-900">
		<iframe
			class="absolute inset-0 h-full w-full"
			src="https://www.youtube-nocookie.com/embed/{video.id}?rel=0"
			{title}
			allow="encrypted-media; picture-in-picture; fullscreen"
			allowfullscreen
		></iframe>
	</div>
{/if}
<a
	class="inline-flex min-h-11 w-fit items-center rounded-md border border-navy-700 px-4 font-bold text-navy-700 hover:bg-navy-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 sm:min-h-10"
	href={url}
	target="_blank"
	rel="noopener noreferrer">{t('training.practice.openLink')}</a
>
