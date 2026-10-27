<script lang="ts">
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickPortal } from '#lib/i18n/localized.ts';
	import QuestionForm from '../QuestionForm.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 27 "Question bank": edit, hide / restore; a question is never deleted. */
	let { data, form }: PageProps = $props();
	const values = $derived((form && 'values' in form && form.values) || data.values);
	const errors = $derived(form && 'errors' in form ? form.errors : undefined);
	const base = $derived(`/admin/training/${data.course.id}/questions`);
	const text = $derived(pickPortal(data.question.text, currentLocale()));
	const title = $derived(text.length > 80 ? `${text.slice(0, 80)}…` : text);
</script>

<svelte:head><title>{title} — {t('admin.title')}</title></svelte:head>

<a href={base} class="text-sm text-navy-700 underline-offset-2 hover:underline"
	>{t('training.question.back')}</a
>
<div class="mb-4 flex flex-wrap items-center gap-3">
	<h2 class="text-xl font-bold">{title}</h2>
	{#if data.question.hidden}<Badge tone="warning">{t('training.questions.hidden')}</Badge>{/if}
	<form method="POST" action={data.question.hidden ? '?/restore' : '?/hide'} class="ml-auto">
		<Button type="submit" variant="secondary">
			{data.question.hidden ? t('training.question.restore') : t('training.question.hide')}
		</Button>
	</form>
</div>

{#if form && 'stateError' in form}
	<p role="alert" class="mb-4 rounded-md bg-error-bg p-3 text-sm text-error-fg">
		{t('training.error.questionState')}
	</p>
{:else if form && 'saved' in form}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t('users.saved')}
	</p>
{/if}
{#if data.question.hidden}
	<p class="mb-4 text-sm text-ink-700">{t('training.question.hiddenNote')}</p>
{/if}

{#key data.values}
	<QuestionForm action="?/update" cancelHref={base} {values} {errors} topics={data.topics} />
{/key}
