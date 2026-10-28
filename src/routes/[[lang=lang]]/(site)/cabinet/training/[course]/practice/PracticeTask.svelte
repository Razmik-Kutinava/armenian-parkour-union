<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '#lib/components/ui/Button.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickPortal } from '#lib/i18n/localized.ts';
	import type { PracticeTaskView } from '#lib/server/services/training/practice-read.ts';
	import type { SubmitRefusal } from '#lib/server/services/training/practice-submit.ts';
	import { quizMoment } from '../quiz-state';

	/* docs/06 section 5.11 "Practice": the task, the link field while it is not accepted, the status,
	 * the history. */
	type Props = {
		task: PracticeTaskView;
		open: boolean;
		sent: 'sent' | 'replaced' | null;
		failed: { url: string; error: Exclude<SubmitRefusal, 'not_found'> } | null;
	};
	let { task, open, sent, failed }: Props = $props();
	const text = (value: Parameters<typeof pickPortal>[0]) => pickPortal(value, currentLocale());
	const current = $derived(task.current);
	const canSend = $derived(open && current?.status !== 'approved');
	const tone = {
		pending: 'bg-info-bg text-info-fg',
		approved: 'bg-success-bg text-success-fg',
		rejected: 'bg-warning-bg text-warning-fg'
	};
</script>

<section class="flex flex-col gap-3 rounded-lg border border-line p-4">
	<h2 class="text-xl font-bold text-ink-900">{text(task.title)}</h2>
	{#if text(task.description)}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<div class="rich-text">{@html text(task.description)}</div>
	{/if}
	{#if current}
		<p class="w-fit rounded-md px-3 py-1 font-bold {tone[current.status]}">
			{t(`cabinet.practice.status.${current.status}`)}
		</p>
		{#if current.status === 'rejected' && current.note}
			<p class="text-ink-900">{t('cabinet.practice.note', { note: current.note })}</p>
		{/if}
	{/if}
	{#if sent}
		<p role="status" class="text-sm text-success-fg">{t(`cabinet.practice.${sent}`)}</p>
	{/if}
	{#if canSend}
		<form method="POST" action="?/submit" use:enhance class="flex flex-col gap-2">
			<input type="hidden" name="taskId" value={task.id} />
			<Input
				label={t('cabinet.practice.link')}
				hint={t('cabinet.practice.hint')}
				name="url"
				type="url"
				inputmode="url"
				value={failed?.url ?? (current?.status === 'pending' ? current.url : '')}
				error={failed ? t(`cabinet.practice.error.${failed.error}`) : undefined}
			/>
			<div>
				<Button type="submit"
					>{t(
						current?.status === 'pending' ? 'cabinet.practice.replace' : 'cabinet.practice.send'
					)}</Button
				>
			</div>
		</form>
	{/if}
	{#if task.history.length > 0}
		<details>
			<summary class="cursor-pointer font-bold text-navy-700"
				>{t('cabinet.practice.history')}</summary
			>
			<ul class="mt-2 flex flex-col gap-1 text-sm">
				{#each task.history as h (h.id)}
					<li>
						{quizMoment(h.createdAt)} — {t(`cabinet.practice.status.${h.status}`)} ·
						<a
							class="text-navy-700 underline"
							href={h.url}
							target="_blank"
							rel="noopener noreferrer">{t('cabinet.practice.video')}</a
						>
						{#if h.note}<span class="text-ink-700">— {h.note}</span>{/if}
					</li>
				{/each}
			</ul>
		</details>
	{/if}
</section>
