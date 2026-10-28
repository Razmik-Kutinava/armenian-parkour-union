<script lang="ts">
	import { onMount } from 'svelte';
	import { deserialize, enhance } from '$app/forms';
	import Button from '#lib/components/ui/Button.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickPortal } from '#lib/i18n/localized.ts';
	import type { QuizStatus } from '#lib/server/services/training/quiz-read.ts';

	/* docs/06 section 5.11 "Quiz": all questions on one page, one option each, a timer; each choice
	 * is saved on the server, without JavaScript the answers go with "Finish". The server keeps the
	 * time: the timer only shows it and sends the form at zero. */
	let { running }: { running: NonNullable<QuizStatus['running']> } = $props();

	let form: HTMLFormElement;
	let left = $state(0);
	let saveFailed = $state(false);
	let timeUp = false;

	onMount(() => {
		const deadline = Date.now() + running.secondsLeft * 1000;
		const tick = () => {
			left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
			if (left === 0 && !timeUp) {
				timeUp = true;
				form.requestSubmit();
			}
		};
		tick();
		const timer = setInterval(tick, 1000);
		return () => clearInterval(timer);
	});

	const clock = $derived(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`);

	async function save() {
		const res = await fetch('?/save', {
			method: 'POST',
			body: new FormData(form),
			headers: { 'x-sveltekit-action': 'true' }
		}).catch(() => null);
		saveFailed = !res || deserialize(await res.text()).type !== 'success';
	}
</script>

<form
	bind:this={form}
	method="POST"
	action="?/submit"
	class="flex flex-col gap-6"
	use:enhance={({ cancel }) => {
		if (!timeUp && !confirm(t('cabinet.quiz.confirm'))) cancel();
	}}
>
	<input type="hidden" name="attemptId" value={running.id} />
	<p
		class="sticky top-0 z-10 w-fit rounded-md bg-info-bg px-3 py-2 font-bold text-info-fg"
		aria-live="off"
	>
		{t('cabinet.quiz.timeLeft')}: <span class="tabular-nums">{clock}</span>
	</p>

	{#each running.questions as question, i (i)}
		<fieldset class="flex flex-col gap-2 rounded-lg border border-line p-4">
			<legend class="px-1 text-sm text-ink-700">
				{t('cabinet.quiz.question', { n: i + 1, total: running.questions.length })}
			</legend>
			<p class="font-bold text-ink-900">{pickPortal(question.text, currentLocale())}</p>
			{#each question.options as option, j (j)}
				<label class="flex min-h-11 items-center gap-3 rounded-md px-2 hover:bg-info-bg">
					<input
						type="radio"
						name="q{i}"
						value={j}
						checked={running.answers[i] === j}
						onchange={save}
					/>
					<span>{pickPortal(option, currentLocale())}</span>
				</label>
			{/each}
		</fieldset>
	{/each}

	{#if saveFailed}
		<p role="alert" class="rounded-md bg-error-bg p-3 text-sm text-error-fg">
			{t('cabinet.quiz.saveFailed')}
		</p>
	{/if}
	<Button type="submit">{t('cabinet.quiz.finish')}</Button>
</form>
