<script lang="ts">
	import Badge from '#lib/components/ui/Badge.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';

	type Status = 'pending' | 'approved' | 'rejected';
	type Props = {
		videos: { id: string; url: string; title: string | null; status: Status; createdAt: Date }[];
	};
	let { videos }: Props = $props();

	const TONES = { pending: 'warning', approved: 'success', rejected: 'error' } as const;
	const day = (date: Date) =>
		date.toLocaleDateString(currentLocale(), { dateStyle: 'medium', timeZone: 'Asia/Yerevan' });
</script>

<section class="flex flex-col gap-4" aria-labelledby="videos-list-title">
	<h2 id="videos-list-title" class="text-xl font-bold text-ink-900">
		{t('cabinet.videos.list')}
	</h2>
	{#if videos.length === 0}
		<p class="text-ink-700">{t('cabinet.videos.empty')}</p>
	{:else}
		<ul class="divide-y divide-line rounded-md border border-line bg-surface">
			{#each videos as video (video.id)}
				<li class="flex flex-wrap items-center justify-between gap-3 p-4">
					<div class="flex min-w-0 flex-col gap-1">
						<a
							class="font-bold break-words text-navy-700 underline hover:no-underline"
							href={video.url}
							target="_blank"
							rel="noopener noreferrer"
						>
							{video.title || video.url}
						</a>
						<span class="text-sm text-ink-500">{day(video.createdAt)}</span>
					</div>
					<Badge tone={TONES[video.status]}>{t(`videos.status.${video.status}`)}</Badge>
				</li>
			{/each}
		</ul>
	{/if}
</section>
