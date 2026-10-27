<script lang="ts">
	import FormLayout from '#lib/components/admin/FormLayout.svelte';
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import LocalizedInput from '#lib/components/admin/LocalizedInput.svelte';
	import Checkbox from '#lib/components/ui/Checkbox.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { EXAM_KINDS } from '#lib/validation/exam-enums.ts';
	import { COURSE_LEVELS, COURSE_STATUSES } from '#lib/validation/training-enums.ts';

	/* docs/05 section 27: course, quiz settings, admission conditions. */
	type Props = {
		action?: string;
		values: Record<string, string | undefined>;
		errors?: Partial<Record<string, MessageKey>>;
	};
	let { action, values, errors = {} }: Props = $props();
	const shown = $derived(
		Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v && t(v)]))
	);
	const field = (name: string) => ({ name, value: values[name] ?? '', error: shown[name] });
	const number = (name: string, label: MessageKey) => ({
		...field(name),
		label: t(label),
		inputmode: 'numeric' as const
	});

	let quizSize = $state<string>();
	let passCount = $state<string>();
	const percent = $derived.by(() => {
		const total = Number(quizSize ?? values.quizSize);
		const pass = Number(passCount ?? values.passCount);
		return total > 0 && pass > 0 ? Math.round((pass / total) * 100) : null;
	});
</script>

<FormLayout {action} cancelHref="/admin/training" novalidate>
	<FormSection title={t('training.course.section.main')}>
		<Input
			label={t('training.course.slug')}
			hint={t('training.course.slugHint')}
			required
			{...field('slug')}
		/>
		<Select
			label={t('training.course.examKind')}
			name="examKind"
			value={values.examKind ?? 'trainer'}
			options={EXAM_KINDS.map((k) => ({ value: k, label: t(`exams.kind.${k}`) }))}
			error={shown.examKind}
		/>
		<LocalizedInput
			name="title"
			label={t('training.course.title')}
			{values}
			errors={shown}
			required
		/>
		<LocalizedInput
			name="description"
			label={t('training.course.description')}
			{values}
			errors={shown}
		/>
		<Select
			label={t('training.course.status')}
			name="status"
			value={values.status ?? 'draft'}
			options={COURSE_STATUSES.map((s) => ({ value: s, label: t(`training.status.${s}`) }))}
			error={shown.status}
		/>
	</FormSection>
	<FormSection title={t('training.course.section.quiz')} text={t('training.course.quizHint')}>
		<div class="grid gap-4 sm:grid-cols-2">
			<Input
				{...number('quizSize', 'training.course.quizSize')}
				oninput={(e) => (quizSize = e.currentTarget.value)}
			/>
			<Input
				{...number('passCount', 'training.course.passCount')}
				hint={percent === null ? undefined : t('training.course.passPercent', { percent })}
				oninput={(e) => (passCount = e.currentTarget.value)}
			/>
			<Input {...number('quizMinutes', 'training.course.quizMinutes')} />
			<Input {...number('retakeDays', 'training.course.retakeDays')} />
			<Input {...number('attemptsLimit', 'training.course.attemptsLimit')} />
			<Input {...number('attemptsPeriodDays', 'training.course.attemptsPeriodDays')} />
		</div>
	</FormSection>
	<FormSection title={t('training.course.section.admission')}>
		<Checkbox
			label={t('training.course.requiresMembership')}
			name="requiresMembership"
			checked={values.requiresMembership === 'on'}
		/>
		<div class="grid gap-4 sm:grid-cols-2">
			<Input
				{...number('minAge', 'training.course.minAge')}
				hint={t('training.course.minAgeHint')}
			/>
			<Select
				label={t('training.course.requiredLevel')}
				name="requiredLevel"
				value={values.requiredLevel ?? ''}
				options={[
					{ value: '', label: t('training.course.levelAny') },
					...COURSE_LEVELS.map((l) => ({ value: l, label: t(`level.${l}`) }))
				]}
				error={shown.requiredLevel}
			/>
		</div>
	</FormSection>
</FormLayout>
