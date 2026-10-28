<script lang="ts">
	import FormLayout from '#lib/components/admin/FormLayout.svelte';
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import LocalizedInput from '#lib/components/admin/LocalizedInput.svelte';
	import LocalizedRichText from '#lib/components/admin/LocalizedRichText.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';

	/* docs/05 section 27 "Practice tasks": title ×3, description ×3 (what to show, video
	 * requirements, criteria), order. */
	type Props = {
		action?: string;
		cancelHref: string;
		values: Record<string, string | undefined>;
		errors?: Partial<Record<string, MessageKey>>;
	};
	let { action, cancelHref, values, errors = {} }: Props = $props();
	const shown = $derived(
		Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v && t(v)]))
	);
</script>

<FormLayout {action} {cancelHref} novalidate>
	<FormSection title={t('training.task.section.main')}>
		<LocalizedInput name="title" label={t('training.task.title')} {values} errors={shown} />
		<p class="text-sm text-ink-700">{t('training.task.descriptionHint')}</p>
		<LocalizedRichText
			name="description"
			label={t('training.task.description')}
			{values}
			errors={shown}
		/>
		<Input
			label={t('training.task.sortOrder')}
			hint={t('training.task.sortOrderHint')}
			inputmode="numeric"
			name="sortOrder"
			value={values.sortOrder ?? '0'}
			error={shown.sortOrder}
		/>
	</FormSection>
</FormLayout>
