<script lang="ts">
	import { enhance } from '$app/forms';
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import { eventMoment } from '#lib/components/site/event-date.ts';
	import Button from '#lib/components/ui/Button.svelte';
	import Checkbox from '#lib/components/ui/Checkbox.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { controlClass } from '#lib/components/ui/control.ts';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized, type LocalizedText } from '#lib/i18n/localized.ts';
	import type { MessageKey } from '#lib/i18n/translate.ts';
	import { EXAM_KINDS, EXAM_TEXT_MAX } from '#lib/validation/exam-enums.ts';

	/* docs/05 section 7: kind, date, event, examiner, notes; a level that does not fit only warns —
	 * the staff confirm and send again. */
	type Option = { id: string; name: string };
	type EventOption = { id: string; title: LocalizedText; startsAt: Date };
	type Result = {
		values?: Record<string, string>;
		errors?: Partial<Record<string, MessageKey>>;
		warnings?: string[];
		message?: MessageKey;
	};
	let {
		memberId,
		kind,
		examiners,
		events,
		form
	}: {
		memberId: string;
		kind: string;
		examiners: Option[];
		events: EventOption[];
		form: Result | null | undefined;
	} = $props();

	const values = $derived(form?.values ?? {});
	const errorOf = (field: string) => {
		const key = form?.errors?.[field];
		return key ? t(key) : undefined;
	};
	const levelWarning = $derived(form?.warnings?.includes('level_mismatch') ?? false);
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
	<FormSection title={t('exams.new')}>
		<Select
			label={t('exams.form.kind')}
			name="kind"
			value={values.kind ?? kind}
			options={EXAM_KINDS.map((k) => ({ value: k, label: t(`exams.kind.${k}`) }))}
			error={errorOf('kind')}
			required
		/>
		<Input
			label={t('exams.form.date')}
			hint={t('exams.form.dateHint')}
			name="scheduledAt"
			type="datetime-local"
			value={values.scheduledAt ?? ''}
			error={errorOf('scheduledAt')}
			required
		/>
		<Select
			label={t('exams.form.event')}
			name="eventId"
			value={values.eventId ?? ''}
			options={[
				{ value: '', label: t('exams.form.eventNone') },
				...events.map((e) => ({
					value: e.id,
					label: `${pickLocalized(e.title, currentLocale())} · ${eventMoment(e.startsAt, currentLocale())}`
				}))
			]}
			error={errorOf('eventId')}
		/>
		<Select
			label={t('exams.form.examiner')}
			name="examinerId"
			value={values.examinerId ?? ''}
			options={[
				{ value: '', label: t('exams.form.examinerNone') },
				...examiners.map((e) => ({ value: e.id, label: e.name }))
			]}
			error={errorOf('examinerId')}
		/>
		<Field label={t('exams.form.notes')} error={errorOf('notes')}>
			{#snippet control({ id, describedBy, invalid })}
				<textarea
					{id}
					name="notes"
					maxlength={EXAM_TEXT_MAX}
					rows="3"
					aria-describedby={describedBy}
					aria-invalid={invalid || undefined}
					class="{controlClass} px-3 py-2">{values.notes ?? ''}</textarea
				>
			{/snippet}
		</Field>
	</FormSection>
	{#if levelWarning}
		<div role="alert" class="flex flex-col gap-2 rounded-md bg-warning-bg p-3 text-warning-fg">
			<p>{t('exams.warning.level_mismatch')}</p>
			<Checkbox name="confirmLevel" label={t('exams.form.confirmLevel')} />
		</div>
	{/if}
	<div class="flex justify-end">
		<Button type="submit">{t('exams.form.submit')}</Button>
	</div>
</form>
