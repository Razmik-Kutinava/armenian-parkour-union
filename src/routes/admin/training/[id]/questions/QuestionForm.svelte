<script lang="ts">
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import FormLayout from '#lib/components/admin/FormLayout.svelte';
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import LocalizedInput from '#lib/components/admin/LocalizedInput.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { currentLocale, t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { pickPortal, type PortalText } from '#lib/i18n/localized.ts';
	import { QUESTION_OPTION_ROWS } from '#lib/validation/training-enums.ts';

	/* docs/05 section 27 "Question bank": topic, text ×3, 2–6 options ×3 with one correct, source. */
	type Props = {
		action?: string;
		cancelHref: string;
		values: Record<string, string | undefined>;
		errors?: Partial<Record<string, MessageKey>>;
		topics: { id: string; title: PortalText; hidden: boolean }[];
	};
	let { action, cancelHref, values, errors = {}, topics }: Props = $props();
	const shown = $derived(
		Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v && t(v)]))
	);
	const rows = Array.from({ length: QUESTION_OPTION_ROWS }, (_, n) => n);
	const topicLabel = (topic: Props['topics'][number]) => {
		const title = pickPortal(topic.title, currentLocale());
		return topic.hidden ? t('training.lessons.hiddenTopic', { topic: title }) : title;
	};
</script>

{#snippet problem(text: string | undefined)}
	{#if text}
		<p role="alert" class="flex items-center gap-1 text-sm text-error-fg">
			<CircleAlert class="size-4 shrink-0" aria-hidden="true" />{text}
		</p>
	{/if}
{/snippet}

<FormLayout {action} {cancelHref} novalidate>
	<FormSection title={t('training.question.section.main')}>
		<Select
			label={t('training.question.topic')}
			name="topicId"
			value={values.topicId ?? ''}
			placeholder={t('training.question.topicChoose')}
			options={topics.map((topic) => ({ value: topic.id, label: topicLabel(topic) }))}
			error={shown.topicId}
		/>
		<LocalizedInput name="text" label={t('training.question.text')} {values} errors={shown} />
		<Input
			label={t('training.question.source')}
			hint={t('training.question.sourceHint')}
			name="source"
			value={values.source ?? ''}
			error={shown.source}
		/>
	</FormSection>
	<FormSection title={t('training.question.section.options')}>
		<p class="text-sm text-ink-700">{t('training.question.optionsHint')}</p>
		{@render problem(shown.options)}
		{@render problem(shown.correct)}
		{#each rows as n (n)}
			<div class="flex flex-col gap-2 rounded-md border border-line p-3">
				<label class="inline-flex min-h-11 items-center gap-2 text-sm font-bold sm:min-h-10">
					<input
						type="radio"
						name="correct"
						value={String(n)}
						checked={values.correct === String(n)}
						class="size-5 accent-navy-700"
					/>
					{t('training.question.correct')}
				</label>
				<LocalizedInput
					name="option{n}"
					label={t('training.question.option', { n: n + 1 })}
					{values}
					errors={shown}
				/>
			</div>
		{/each}
	</FormSection>
</FormLayout>
