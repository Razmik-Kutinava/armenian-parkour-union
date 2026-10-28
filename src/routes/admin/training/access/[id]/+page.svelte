<script lang="ts">
	import { eventMoment } from '#lib/components/site/event-date.ts';
	import Badge from '#lib/components/ui/Badge.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickPortal } from '#lib/i18n/localized.ts';
	import type { PageProps } from './$types';

	/* docs/05 section 27 "Requests": the member card — quiz attempts, practice by task, the exam. */
	let { data }: PageProps = $props();
	const c = $derived(data.card);
	const local = (text: Parameters<typeof pickPortal>[0]) => pickPortal(text, currentLocale());
	const at = (date: Date) => eventMoment(date, currentLocale());
	const link = 'font-bold text-navy-700 underline-offset-2 hover:underline';
	const resultTone = {
		passed: 'success',
		failed: 'warning',
		running: 'info',
		expired: 'neutral'
	} as const;
	const practiceTone = { pending: 'info', approved: 'success', rejected: 'warning' } as const;
</script>

<svelte:head><title>{t('training.access.card.title')} — {t('admin.title')}</title></svelte:head>

<a href="/admin/training/access" class="text-sm text-navy-700 underline-offset-2 hover:underline"
	>{t('training.access.card.back')}</a
>
<div class="mb-4 flex flex-wrap items-center gap-3">
	<h1 class="text-2xl font-bold">
		<a class={link} href="/admin/users/{c.userId}">{c.name}</a>: {local(c.courseTitle)}
	</h1>
	<Badge>{t(`training.access.status.${c.status}`)}</Badge>
</div>

<ul class="mb-6 flex flex-col gap-1 text-ink-700">
	<li>{t('training.access.card.applied', { date: at(c.createdAt) })}</li>
	{#if c.reviewedAt}<li>{t('training.access.card.reviewed', { date: at(c.reviewedAt) })}</li>{/if}
	{#if c.reviewNote}<li>{t('training.access.card.note', { note: c.reviewNote })}</li>{/if}
	{#if c.extraAttempts > 0}
		<li>{t('training.access.extraUnused', { count: c.extraAttempts })}</li>
	{/if}
</ul>

<h2 class="mb-3 text-xl font-bold">{t('training.access.card.exam')}</h2>
<p class="mb-6">
	{#if c.examId}
		{t('training.access.card.finished')}
		<a class={link} href="/admin/exams/{c.examId}">{t('training.access.card.examLink')}</a>
	{:else}
		{t('training.access.card.notFinished')}
	{/if}
</p>

<h2 class="mb-3 text-xl font-bold">{t('training.access.card.attempts')}</h2>
{#if c.attempts.length === 0}
	<p class="mb-6 text-ink-700">{t('training.access.card.noAttempts')}</p>
{:else}
	<ul class="mb-6 flex flex-col gap-2">
		{#each c.attempts as a (a.id)}
			<li class="flex flex-wrap items-center gap-3 rounded-md border border-line p-3">
				<a class={link} href="/admin/training/attempts/{a.id}">{at(a.startedAt)}</a>
				<span>{a.correctCount ?? '—'} / {a.total}</span>
				<Badge tone={resultTone[a.result]}>{t(`training.attempts.result.${a.result}`)}</Badge>
				{#if a.isExtra}<Badge tone="accent">{t('training.attempts.extra')}</Badge>{/if}
			</li>
		{/each}
	</ul>
{/if}

<h2 class="mb-3 text-xl font-bold">
	{t('training.access.card.practice', { accepted: c.practice.accepted, total: c.practice.total })}
</h2>
{#if c.practice.tasks.length === 0}
	<p class="text-ink-700">{t('training.access.card.noTasks')}</p>
{:else}
	<ul class="flex flex-col gap-2">
		{#each c.practice.tasks as task (task.id)}
			<li class="flex flex-wrap items-center gap-3 rounded-md border border-line p-3">
				<span class="font-bold">{local(task.title)}</span>
				{#if task.current}
					<Badge tone={practiceTone[task.current.status]}
						>{t(`training.practice.status.${task.current.status}`)}</Badge
					>
					<a class={link} href="/admin/training/practice/{task.current.id}"
						>{t('training.access.card.open')}</a
					>
				{:else}
					<Badge>{t('training.access.card.noSubmission')}</Badge>
				{/if}
				<span class="text-sm text-ink-700"
					>{t('training.access.card.submissions', { count: task.count })}</span
				>
			</li>
		{/each}
	</ul>
{/if}
