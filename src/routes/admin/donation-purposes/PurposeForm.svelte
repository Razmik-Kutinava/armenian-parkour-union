<script lang="ts">
	import FormLayout from '#lib/components/admin/FormLayout.svelte';
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import LocalizedInput from '#lib/components/admin/LocalizedInput.svelte';
	import Checkbox from '#lib/components/ui/Checkbox.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';

	/* docs/05 section 17: title ×3, active, order. */
	type Props = {
		action?: string;
		values: Record<string, string | undefined>;
		errors?: Partial<Record<string, MessageKey>>;
	};
	let { action, values, errors = {} }: Props = $props();
	const shown = $derived(
		Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v && t(v)]))
	);
</script>

<FormLayout {action} cancelHref="/admin/donation-purposes" novalidate>
	<FormSection title={t('purposes.title')}>
		<LocalizedInput name="title" label={t('purposes.title')} {values} errors={shown} required />
		<Checkbox label={t('purposes.active')} name="isActive" checked={values.isActive === 'on'} />
		<Input
			label={t('purposes.order')}
			name="sortOrder"
			inputmode="numeric"
			hint={t('purposes.orderHint')}
			value={values.sortOrder ?? '0'}
			error={shown.sortOrder}
		/>
	</FormSection>
</FormLayout>
