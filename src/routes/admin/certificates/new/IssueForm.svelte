<script lang="ts">
	import { enhance } from '$app/forms';
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import { eventMoment } from '#lib/components/site/event-date.ts';
	import Button from '#lib/components/ui/Button.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { controlClass } from '#lib/components/ui/control.ts';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import type { MessageKey } from '#lib/i18n/translate.ts';
	import {
		CERTIFICATE_CATEGORY_MAX,
		CERTIFICATE_COMMENT_MAX,
		CERTIFICATE_KINDS,
		CERTIFICATE_LEVELS
	} from '#lib/validation/certificate-enums.ts';
	import type { ExamKindValue } from '#lib/validation/exam-enums.ts';

	/* docs/05 section 8: type, level or category, exam (or a comment), issue day, expiry. Fields of
	 * the other types hide once a type is chosen; the server drops them anyway. */
	type Exam = { id: string; kind: ExamKindValue; scheduledAt: Date | null };
	type Result = {
		values?: Record<string, string>;
		errors?: Partial<Record<string, MessageKey>>;
		message?: MessageKey;
	};
	let {
		memberId,
		prefill,
		exams,
		staffValidMonths,
		form
	}: {
		memberId: string;
		prefill: { kind: string; level: string; examId: string };
		exams: Exam[];
		staffValidMonths: number;
		form: Result | null | undefined;
	} = $props();

	const values: Record<string, string> = $derived(form?.values ?? prefill);
	let kind = $derived(values.kind ?? '');
	const errorOf = (field: string) => {
		const key = form?.errors?.[field];
		return key ? t(key) : undefined;
	};
	const examLabel = (e: Exam) =>
		`${t(`exams.kind.${e.kind}`)}${e.scheduledAt ? ` · ${eventMoment(e.scheduledAt, currentLocale())}` : ''}`;
	const keep =
		() =>
		({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) =>
			update({ reset: false });
</script>

<form method="POST" class="flex flex-col gap-6" use:enhance={keep}>
	<input type="hidden" name="userId" value={memberId} />
	{#if form?.message}
		<p role="alert" class="rounded-md bg-error-bg p-3 text-sm text-error-fg">{t(form.message)}</p>
	{/if}
	<FormSection title={t('certificates.new')} text={t('certificates.form.note')}>
		<Select
			label={t('certificates.form.kind')}
			name="kind"
			bind:value={kind}
			placeholder="—"
			options={CERTIFICATE_KINDS.map((k) => ({
				value: k,
				label: t(`certificates.admin.kind.${k}`)
			}))}
			error={errorOf('kind')}
			required
		/>
		{#if kind !== 'trainer' && kind !== 'judge'}
			<Select
				label={t('certificates.form.level')}
				name="level"
				value={values.level ?? ''}
				placeholder="—"
				options={CERTIFICATE_LEVELS.map((l) => ({ value: l, label: t(`level.${l}`) }))}
				error={errorOf('level')}
			/>
		{/if}
		{#if kind !== 'level'}
			<Input
				label={t('certificates.form.category')}
				hint={t('certificates.form.categoryHint')}
				name="category"
				maxlength={CERTIFICATE_CATEGORY_MAX}
				value={values.category ?? ''}
				error={errorOf('category')}
			/>
		{/if}
		<Select
			label={t('certificates.form.exam')}
			name="examId"
			value={values.examId ?? ''}
			options={[
				{ value: '', label: t('certificates.form.examNone') },
				...exams.map((e) => ({ value: e.id, label: examLabel(e) }))
			]}
			error={errorOf('examId')}
		/>
		<Input
			label={t('certificates.form.issuedAt')}
			hint={t('certificates.form.issuedAtHint')}
			name="issuedAt"
			type="date"
			value={values.issuedAt ?? ''}
			error={errorOf('issuedAt')}
		/>
		{#if kind !== 'level'}
			<Input
				label={t('certificates.form.expiresAt')}
				hint={t('certificates.form.expiresAtHint', { months: staffValidMonths })}
				name="expiresAt"
				type="date"
				value={values.expiresAt ?? ''}
				error={errorOf('expiresAt')}
			/>
		{/if}
		<Field
			label={t('certificates.form.comment')}
			hint={t('certificates.form.commentHint')}
			error={errorOf('comment')}
		>
			{#snippet control({ id, describedBy, invalid })}
				<textarea
					{id}
					name="comment"
					maxlength={CERTIFICATE_COMMENT_MAX}
					rows="3"
					aria-describedby={describedBy}
					aria-invalid={invalid || undefined}
					class="{controlClass} px-3 py-2">{values.comment ?? ''}</textarea
				>
			{/snippet}
		</Field>
	</FormSection>
	<div class="flex justify-end">
		<Button type="submit">{t('certificates.form.submit')}</Button>
	</div>
</form>
