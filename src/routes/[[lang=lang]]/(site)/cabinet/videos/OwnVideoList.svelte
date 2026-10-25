<script lang="ts">
	import { enhance } from '$app/forms';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';

	/* docs/06 section 5.7: status, reject reason, points earned; delete until approved — the server
	 * checks it again (docs/todo.md 7.7, decisions 1, 2). */
	type Status = 'pending' | 'approved' | 'rejected';
	type Props = {
		videos: {
			id: string;
			url: string;
			title: string | null;
			status: Status;
			rejectReason: string | null;
			points: number | null;
			createdAt: Date;
		}[];
	};
	let { videos }: Props = $props();
	let deleting = $state<string | null>(null);

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
						{#if video.status === 'rejected' && video.rejectReason}
							<span class="text-sm break-words text-ink-700">
								{t('cabinet.videos.reason', { reason: video.rejectReason })}
							</span>
						{/if}
					</div>
					<div class="flex flex-wrap items-center gap-3">
						{#if video.points && video.points > 0}
							<span class="text-sm font-bold text-success-fg">
								{t('cabinet.videos.points', { points: video.points })}
							</span>
						{/if}
						<Badge tone={TONES[video.status]}>{t(`videos.status.${video.status}`)}</Badge>
						{#if video.status !== 'approved'}
							<form
								method="POST"
								action="?/delete"
								use:enhance={() => {
									deleting = video.id;
									return async ({ update }) => {
										await update();
										deleting = null;
									};
								}}
							>
								<input type="hidden" name="id" value={video.id} />
								<Button type="submit" variant="secondary" size="sm" loading={deleting === video.id}>
									{t('cabinet.videos.delete')}
								</Button>
							</form>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>
