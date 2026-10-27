<script lang="ts">
	import FormLayout from '#lib/components/admin/FormLayout.svelte';
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import LocalizedInput from '#lib/components/admin/LocalizedInput.svelte';
	import LocalizedRichText from '#lib/components/admin/LocalizedRichText.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { currentLocale, t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { pickPortal, type PortalText } from '#lib/i18n/localized.ts';
	import { COURSE_STATUSES } from '#lib/validation/training-enums.ts';

	/* docs/05 section 27 "Lessons": topic, title ×3, text (the news editor), order, status. */
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
	const topicLabel = (topic: Props['topics'][number]) => {
		const title = pickPortal(topic.title, currentLocale());
		return topic.hidden ? t('training.lessons.hiddenTopic', { topic: title }) : title;
	};
</script>

<FormLayout {action} {cancelHref} novalidate>
	<FormSection title={t('training.lesson.section.main')}>
		<Select
			label={t('training.lesson.topic')}
			name="topicId"
			value={values.topicId ?? ''}
			options={[
				{ value: '', label: t('training.lessons.noTopic') },
				...topics.map((topic) => ({ value: topic.id, label: topicLabel(topic) }))
			]}
			error={shown.topicId}
		/>
		<LocalizedInput name="title" label={t('training.lesson.title')} {values} errors={shown} />
		<LocalizedRichText name="body" label={t('training.lesson.body')} {values} errors={shown} />
	</FormSection>
	<FormSection title={t('training.lesson.section.publication')}>
		<Select
			label={t('training.lesson.status')}
			name="status"
			value={values.status ?? 'draft'}
			options={COURSE_STATUSES.map((s) => ({ value: s, label: t(`training.status.${s}`) }))}
			error={shown.status}
		/>
		<Input
			label={t('training.lesson.sortOrder')}
			hint={t('training.lesson.sortOrderHint')}
			inputmode="numeric"
			name="sortOrder"
			value={values.sortOrder ?? '0'}
			error={shown.sortOrder}
		/>
	</FormSection>
</FormLayout>
