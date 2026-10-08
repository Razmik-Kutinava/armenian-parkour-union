<script lang="ts">
	import FormLayout from '#lib/components/admin/FormLayout.svelte';
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import LocalizedInput from '#lib/components/admin/LocalizedInput.svelte';
	import LocalizedRichText from '#lib/components/admin/LocalizedRichText.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import type { PageStatus } from '#lib/validation/pages.ts';

	/* docs/05 section 19: title ×3, text ×3, status; the address is fixed for system pages. */
	type Props = {
		action?: string;
		values: Record<string, string | undefined>;
		errors?: Partial<Record<string, MessageKey>>;
		isSystem?: boolean;
	};
	let { action, values, errors = {}, isSystem = false }: Props = $props();
	const shown = $derived(
		Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v && t(v)]))
	);
	const statuses: PageStatus[] = ['draft', 'published', 'archived'];
</script>

<FormLayout {action} cancelHref="/admin/pages" novalidate>
	<FormSection title={t('pages.title')}>
		<Input
			label={t('pages.slug')}
			name="slug"
			value={values.slug ?? ''}
			readonly={isSystem}
			hint={t(isSystem ? 'pages.slugSystem' : 'pages.slugHint')}
			error={shown.slug}
			required
		/>
		<LocalizedInput name="title" label={t('pages.title')} {values} errors={shown} required />
		<Select
			label={t('pages.status')}
			name="status"
			value={values.status ?? 'draft'}
			options={statuses.map((s) => ({ value: s, label: t(`pages.status.${s}`) }))}
			error={shown.status}
		/>
	</FormSection>
	<FormSection title={t('pages.body')}>
		<LocalizedRichText name="body" label={t('pages.body')} {values} errors={shown} />
	</FormSection>
</FormLayout>
