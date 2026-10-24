<script lang="ts">
	import { enhance } from '$app/forms';
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import { controlClass } from '#lib/components/ui/control.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { MessageKey } from '#lib/i18n/translate.ts';
	import { EXAM_DECISIONS, EXAM_TEXT_MAX } from '#lib/validation/exam-enums.ts';

	/* docs/05 section 7: passed / failed / cancelled, a score and a comment; recorded once. */
	let {
		values = {},
		errors = {}
	}: {
		values?: Record<string, string>;
		errors?: Partial<Record<string, MessageKey>>;
	} = $props();
	const errorOf = (field: string) => {
		const key = errors[field];
		return key ? t(key) : undefined;
	};
	const keep =
		() =>
		({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) =>
			update({ reset: false });
</script>

<form method="POST" action="?/result" use:enhance={keep}>
	<FormSection title={t('exams.card.resultTitle')} text={t('exams.card.levelNote')}>
		<fieldset class="flex flex-col gap-2">
			<legend class="mb-1 text-sm font-bold text-ink-900">{t('exams.col.result')}</legend>
			{#each EXAM_DECISIONS as decision (decision)}
				<label class="flex min-h-11 cursor-pointer items-center gap-3">
					<input
						type="radio"
						name="result"
						value={decision}
						checked={values.result === decision}
						required
						class="size-5 accent-navy-700"
					/>
					{t(`exams.result.${decision}`)}
				</label>
			{/each}
			{#if errorOf('result')}<p class="text-sm text-error-fg">{errorOf('result')}</p>{/if}
		</fieldset>
		<Input
			label={t('exams.form.score')}
			hint={t('exams.form.scoreHint')}
			name="score"
			inputmode="decimal"
			value={values.score ?? ''}
			error={errorOf('score')}
		/>
		<Field label={t('exams.form.comment')} error={errorOf('comment')}>
			{#snippet control({ id, describedBy, invalid })}
				<textarea
					{id}
					name="comment"
					maxlength={EXAM_TEXT_MAX}
					rows="3"
					aria-describedby={describedBy}
					aria-invalid={invalid || undefined}
					class="{controlClass} px-3 py-2">{values.comment ?? ''}</textarea
				>
			{/snippet}
		</Field>
		<Button type="submit" class="w-fit">{t('exams.form.saveResult')}</Button>
	</FormSection>
</form>
