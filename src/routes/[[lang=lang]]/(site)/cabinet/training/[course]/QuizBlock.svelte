<script lang="ts">
	import { currentLocale, localizePath, t } from '#lib/i18n/index.svelte.ts';
	import type { QuizStatus } from '#lib/server/services/training/quiz-read.ts';
	import { quizStateText } from './quiz-state';

	/* docs/06 section 5.11 "Portal": the quiz block at the bottom — its state and the way in. */
	let { quiz, slug }: { quiz: QuizStatus; slug: string } = $props();
</script>

<section class="flex flex-col gap-3 rounded-lg border border-line p-4">
	<h2 class="text-xl font-bold text-ink-900">{t('cabinet.quiz.title')}</h2>
	<p class="text-ink-700">
		{t('cabinet.quiz.rules', {
			size: quiz.rules.size,
			need: quiz.rules.passCount,
			minutes: quiz.rules.minutes
		})}
	</p>
	<p class="font-bold text-ink-900">{quizStateText(quiz.state)}</p>
	{#if quiz.last}
		<p class="text-ink-700">
			{t('cabinet.quiz.result', { correct: quiz.last.correct, total: quiz.last.total })}
			{t(quiz.last.passed ? 'cabinet.quiz.passed' : 'cabinet.quiz.failed')}
		</p>
	{/if}
	<a
		class="inline-flex min-h-11 w-fit items-center rounded-md bg-navy-700 px-4 font-bold text-surface hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600"
		href={localizePath(`/cabinet/training/${slug}/test`, currentLocale())}>{t('cabinet.quiz.go')}</a
	>
</section>
