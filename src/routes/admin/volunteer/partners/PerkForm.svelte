<script lang="ts">
	import FormLayout from '#lib/components/admin/FormLayout.svelte';
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import LocalizedInput from '#lib/components/admin/LocalizedInput.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { perkKinds, volunteerStatuses } from '#lib/validation/volunteer-enums.ts';

	/* docs/05 section 28 "Perks": title and terms ×3, reusable or single with a limit per card,
	 * dates "from … until", status, order. */
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
	const field = (name: string) => ({ name, value: values[name] ?? '', error: shown[name] });
</script>

<FormLayout {action} {cancelHref} novalidate>
	<FormSection title={t('volunteer.perk.section')}>
		<LocalizedInput
			name="title"
			label={t('volunteer.perk.title')}
			{values}
			errors={shown}
			required
		/>
		<LocalizedInput name="terms" label={t('volunteer.perk.terms')} {values} errors={shown} />
		<div class="grid gap-4 sm:grid-cols-2">
			<Select
				label={t('volunteer.perk.kind')}
				name="kind"
				value={values.kind ?? 'reusable'}
				options={perkKinds.map((k) => ({ value: k, label: t(`volunteer.perk.kind.${k}`) }))}
				error={shown.kind}
			/>
			<Input
				label={t('volunteer.perk.usesLimit')}
				hint={t('volunteer.perk.usesLimitHint')}
				inputmode="numeric"
				{...field('usesLimit')}
			/>
			<Input
				label={t('volunteer.perk.validFrom')}
				type="date"
				hint={t('volunteer.perk.datesHint')}
				{...field('validFrom')}
			/>
			<Input label={t('volunteer.perk.validUntil')} type="date" {...field('validUntil')} />
		</div>
	</FormSection>
	<FormSection title={t('volunteer.perk.publication')}>
		<Select
			label={t('volunteer.perk.status')}
			name="status"
			hint={t('volunteer.perk.statusHint')}
			value={values.status ?? 'draft'}
			options={volunteerStatuses.map((s) => ({ value: s, label: t(`volunteer.status.${s}`) }))}
			error={shown.status}
		/>
		<Input
			label={t('volunteer.perk.order')}
			hint={t('volunteer.perk.orderHint')}
			inputmode="numeric"
			{...field('sortOrder')}
			value={values.sortOrder ?? '0'}
		/>
	</FormSection>
</FormLayout>
