<script lang="ts">
	import { eventMoment } from '#lib/components/site/event-date.ts';
	import Badge from '#lib/components/ui/Badge.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickPortal } from '#lib/i18n/localized.ts';
	import type { PageProps } from './$types';

	/* docs/05 section 27 "Attempts": snapshot questions, the member's answer and the right one. */
	let { data }: PageProps = $props();
	const c = $derived(data.card);
	const local = (text: Parameters<typeof pickPortal>[0]) => pickPortal(text, currentLocale());
	const at = (date: Date) => eventMoment(date, currentLocale());
	const tone = {
		passed: 'success',
		failed: 'warning',
		running: 'info',
		expired: 'neutral'
	} as const;
	const mark = (q: { answer: number | null; correct: number }) =>
		q.answer === null ? 'none' : q.answer === q.correct ? 'right' : 'wrong';
	const markTone = { right: 'success', wrong: 'error', none: 'neutral' } as const;
</script>

<svelte:head><title>{t('training.attempts.title')} — {t('admin.title')}</title></svelte:head>

<a href="/admin/training/attempts" class="text-sm text-navy-700 underline-offset-2 hover:underline"
	>{t('training.attempts.back')}</a
>
<div class="mb-4 flex flex-wrap items-center gap-3">
	<h1 class="text-2xl font-bold">{c.name}: {local(c.courseTitle)}</h1>
	<Badge tone={tone[c.result]}>{t(`training.attempts.result.${c.result}`)}</Badge>
	{#if c.isExtra}<Badge tone="accent">{t('training.attempts.extra')}</Badge>{/if}
</div>

<ul class="mb-6 flex flex-col gap-1 text-ink-700">
	<li>{t('training.attempts.started', { date: at(c.startedAt) })}</li>
	{#if c.result === 'running'}
		<li>{t('training.attempts.until', { date: at(c.expiresAt) })}</li>
	{:else}
		<li>{t('training.attempts.ended', { date: at(c.endedAt) })}</li>
	{/if}
	<li>
		{#if c.correctCount === null}
			{t('training.attempts.noScore', { total: c.total, pass: c.passCount })}
		{:else}
			{t('training.attempts.score', { correct: c.correctCount, total: c.total, pass: c.passCount })}
		{/if}
	</li>
	<li>
		{t('training.attempts.limit', {
			days: c.limit.periodDays,
			used: c.limit.used,
			limit: c.limit.limit
		})}
	</li>
	<li>{t('training.attempts.extraLeft', { extra: c.limit.extra })}</li>
</ul>

{#if c.questions === null}
	<p class="rounded-md bg-info-bg p-3 text-sm text-info-fg">{t('training.attempts.runningHint')}</p>
{:else}
	<h2 class="mb-3 text-xl font-bold">{t('training.attempts.questions')}</h2>
	<ol class="flex flex-col gap-4">
		{#each c.questions as q, i (i)}
			<li class="rounded-md border border-line p-4">
				<div class="mb-2 flex flex-wrap items-start justify-between gap-2">
					<p class="font-bold">{i + 1}. {local(q.text)}</p>
					<Badge tone={markTone[mark(q)]}>{t(`training.attempts.mark.${mark(q)}`)}</Badge>
				</div>
				<ol class="mb-2 list-[upper-alpha] pl-6 text-ink-700">
					{#each q.options as option, n (n)}
						<li class:font-bold={n === q.correct}>{local(option)}</li>
					{/each}
				</ol>
				<p class="text-sm">
					{t('training.attempts.answer')}:
					{q.answer === null ? t('training.attempts.noAnswer') : local(q.options[q.answer])}
				</p>
				<p class="text-sm">{t('training.attempts.rightAnswer')}: {local(q.options[q.correct])}</p>
			</li>
		{/each}
	</ol>
{/if}
