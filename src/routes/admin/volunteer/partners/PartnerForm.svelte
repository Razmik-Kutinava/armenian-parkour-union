<script lang="ts">
	import CoverPicker from '#lib/components/admin/CoverPicker.svelte';
	import FormLayout from '#lib/components/admin/FormLayout.svelte';
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import LocalizedInput from '#lib/components/admin/LocalizedInput.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { volunteerStatuses } from '#lib/validation/volunteer-enums.ts';

	/* docs/05 section 28 "Partners": name, logo (library), site, address ×3, status. */
	type Props = {
		action?: string;
		values: Record<string, string | undefined>;
		errors?: Partial<Record<string, MessageKey>>;
		images: { key: string; name: string; url: string | null }[];
	};
	let { action, values, errors = {}, images }: Props = $props();
	const shown = $derived(
		Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v && t(v)]))
	);
</script>

<FormLayout {action} cancelHref="/admin/volunteer/partners" novalidate>
	<FormSection title={t('volunteer.partner.section')}>
		<Input
			label={t('volunteer.partner.name')}
			name="name"
			required
			value={values.name ?? ''}
			error={shown.name}
		/>
		<CoverPicker
			name="logoKey"
			label={t('volunteer.partner.logo')}
			hint={t('volunteer.partner.logoHint')}
			value={values.logoKey ?? ''}
			{images}
			error={shown.logoKey}
		/>
		<Input
			label={t('volunteer.partner.website')}
			name="website"
			type="url"
			inputmode="url"
			hint={t('volunteer.partner.websiteHint')}
			value={values.website ?? ''}
			error={shown.website}
		/>
		<LocalizedInput name="address" label={t('volunteer.partner.address')} {values} errors={shown} />
		<Select
			label={t('volunteer.partner.status')}
			name="status"
			hint={t('volunteer.partner.statusHint')}
			value={values.status ?? 'draft'}
			options={volunteerStatuses.map((s) => ({ value: s, label: t(`volunteer.status.${s}`) }))}
			error={shown.status}
		/>
	</FormSection>
</FormLayout>
