<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '#lib/components/ui/Button.svelte';
	import { currentLocale, localizePath, t } from '#lib/i18n/index.svelte.ts';
	import { pickPortal } from '#lib/i18n/localized.ts';
	import PreviewBanner from '../PreviewBanner.svelte';
	import { quizMoment, quizStateText } from '../quiz-state';
	import QuizForm from './QuizForm.svelte';
	import type { PageProps } from './$types';

	/* docs/06 section 5.11 "Quiz": the rules and "Start" (or why not), the attempt, the result
	 * (correct answers are never shown), the history. */
	let { data, form }: PageProps = $props();
	const q = $derived(data.quiz);
	const text = (value: Parameters<typeof pickPortal>[0]) => pickPortal(value, currentLocale());
	const portal = $derived(localizePath(`/cabinet/training/${q.course.slug}`, currentLocale()));
	const sent = $derived(form && 'result' in form ? form.result : null);
	const message = $derived(form && 'message' in form ? form.message : null);
</script>

<svelte:head>
	<title>{t('cabinet.quiz.title')} — {text(q.course.title)} — {t('site.name')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex max-w-3xl flex-col gap-6">
	<a class="font-bold text-navy-700 underline hover:no-underline" href={portal}
		>{t('cabinet.training.backToCourse')}: {text(q.course.title)}</a
	>
	{#if q.preview}<PreviewBanner />{/if}
	<h1 class="text-3xl font-bold text-ink-900">{t('cabinet.quiz.title')}</h1>

	{#if sent}
		<div role="status" class="rounded-md bg-info-bg p-3 text-info-fg">
			<p class="font-bold">
				{t('cabinet.quiz.result', { correct: sent.correct, total: sent.total })}
				{t(sent.passed ? 'cabinet.quiz.passed' : 'cabinet.quiz.failed')}
			</p>
			{#if sent.expired}<p class="text-sm">{t('cabinet.quiz.expired')}</p>{/if}
		</div>
	{/if}
	{#if message}
		<p role="alert" class="rounded-md bg-error-bg p-3 text-sm text-error-fg">{t(message)}</p>
	{/if}

	{#if q.running}
		<QuizForm running={q.running} />
	{:else}
		<section class="flex flex-col gap-2">
			<p class="text-ink-900">
				{t('cabinet.quiz.rules', {
					size: q.rules.size,
					need: q.rules.passCount,
					minutes: q.rules.minutes
				})}
			</p>
			{#if !q.preview}
				<p class="text-ink-700">
					{t('cabinet.quiz.attemptsLeft', {
						left: q.rules.attemptsLeft,
						limit: q.rules.attemptsLimit
					})}
				</p>
				{#if q.rules.extraAttempts > 0}
					<p class="text-ink-700">
						{t('cabinet.quiz.extraLeft', { count: q.rules.extraAttempts })}
					</p>
				{/if}
			{/if}
			<p class="font-bold text-ink-900">{quizStateText(q.state)}</p>
			{#if q.state.kind === 'open'}
				<p class="text-sm text-ink-700">{t('cabinet.quiz.oneTry')}</p>
				<form method="POST" action="?/start" use:enhance>
					<Button type="submit"
						>{t(q.state.extra ? 'cabinet.quiz.startExtra' : 'cabinet.quiz.start')}</Button
					>
				</form>
			{/if}
		</section>
	{/if}

	{#if q.history.length > 0}
		<section class="flex flex-col gap-2">
			<h2 class="text-xl font-bold text-ink-900">{t('cabinet.quiz.history')}</h2>
			<ul class="flex flex-col gap-1">
				{#each q.history as attempt (attempt.id)}
					<li class="text-ink-900">
						{quizMoment(attempt.startedAt)} —
						{t('cabinet.quiz.result', { correct: attempt.correct, total: attempt.total })}
						{t(attempt.passed ? 'cabinet.quiz.passed' : 'cabinet.quiz.failed')}
						{#if attempt.isExtra}<span class="text-sm text-ink-700"
								>({t('cabinet.quiz.extra')})</span
							>{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
