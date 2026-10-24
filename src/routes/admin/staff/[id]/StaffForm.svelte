<script lang="ts">
	import FormLayout from '#lib/components/admin/FormLayout.svelte';
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import Checkbox from '#lib/components/ui/Checkbox.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { STAFF_CATEGORY_MAX, STAFF_LICENSE_MAX } from '#lib/validation/staff-enums.ts';
	import BioField from './BioField.svelte';

	/* docs/05 section 9: category, license, description ×3, public, active. The member and the kind
	 * come from the certificate; "active" is re-checked by the server against a live certificate. */
	type Props = {
		values: Record<string, string | undefined>;
		errors?: Partial<Record<string, MessageKey>>;
	};
	let { values, errors = {} }: Props = $props();
	const shown = $derived(
		Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v && t(v)]))
	);
</script>

<FormLayout action="?/update" cancelHref="/admin/staff" novalidate>
	<FormSection title={t('staff.form.title')}>
		<Input
			label={t('staff.form.category')}
			name="category"
			maxlength={STAFF_CATEGORY_MAX}
			value={values.category ?? ''}
			error={shown.category}
		/>
		<Input
			label={t('staff.form.license')}
			name="licenseNumber"
			maxlength={STAFF_LICENSE_MAX}
			value={values.licenseNumber ?? ''}
			error={shown.licenseNumber}
		/>
		<BioField {values} errors={shown} />
		<Checkbox label={t('staff.form.public')} name="isPublic" checked={values.isPublic === 'on'} />
		<Checkbox
			label={t('staff.form.active')}
			name="isActive"
			checked={values.isActive === 'on'}
			error={shown.isActive}
		/>
		<p class="text-sm text-ink-500">{t('staff.form.activeHint')}</p>
	</FormSection>
</FormLayout>
