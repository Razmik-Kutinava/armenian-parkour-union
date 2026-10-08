<script lang="ts">
	import CoverPicker from '#lib/components/admin/CoverPicker.svelte';
	import FormLayout from '#lib/components/admin/FormLayout.svelte';
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import LocalizedInput from '#lib/components/admin/LocalizedInput.svelte';
	import LocalizedRichText from '#lib/components/admin/LocalizedRichText.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { CURRENCIES } from '#lib/money.ts';
	import { eventFormStatuses } from '#lib/validation/event-enums.ts';

	/* docs/05 section 5: title, address, description ×3, cover, dates, place, price, limit, window. */
	type Props = {
		action?: string;
		values: Record<string, string | undefined>;
		errors?: Partial<Record<string, MessageKey>>;
		images: { key: string; name: string; url: string | null }[];
		/** Finished, cancelled, archived: the status is changed only by its buttons. */
		statusLocked?: boolean;
	};
	let { action, values, errors = {}, images, statusLocked = false }: Props = $props();
	const shown = $derived(
		Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v && t(v)]))
	);
	const field = (name: string) => ({ name, value: values[name] ?? '', error: shown[name] });
</script>

<FormLayout {action} cancelHref="/admin/events" novalidate>
	<FormSection title={t('events.section.main')}>
		<Input label={t('events.slug')} hint={t('events.slugHint')} required {...field('slug')} />
		<LocalizedInput name="title" label={t('events.title')} {values} errors={shown} required />
		<LocalizedRichText name="description" label={t('events.description')} {values} errors={shown} />
		<CoverPicker
			value={values.coverKey ?? ''}
			{images}
			error={shown.coverKey}
			hint={t('events.coverHint')}
		/>
	</FormSection>
	<FormSection title={t('events.section.when')}>
		<div class="grid gap-4 sm:grid-cols-2">
			<Input
				type="datetime-local"
				label={t('events.startsAt')}
				hint={t('events.timeHint')}
				required
				{...field('startsAt')}
			/>
			<Input type="datetime-local" label={t('events.endsAt')} required {...field('endsAt')} />
		</div>
		<Input label={t('events.locationName')} {...field('locationName')} />
		<div class="grid gap-4 sm:grid-cols-2">
			<Input label={t('events.address')} {...field('address')} />
			<Input label={t('events.city')} {...field('city')} />
		</div>
		<div class="grid gap-4 sm:grid-cols-2">
			<Input label={t('events.latitude')} inputmode="decimal" {...field('latitude')} />
			<Input label={t('events.longitude')} inputmode="decimal" {...field('longitude')} />
		</div>
		<p class="-mt-2 text-sm text-ink-500">{t('events.coordsHint')}</p>
	</FormSection>
	<FormSection title={t('events.section.price')}>
		<div class="grid gap-4 sm:grid-cols-2">
			<Input
				label={t('events.price')}
				hint={t('events.priceHint')}
				inputmode="decimal"
				required
				{...field('price')}
				value={values.price ?? '0'}
			/>
			<Select
				label={t('events.currency')}
				name="priceCurrency"
				value={values.priceCurrency ?? 'AMD'}
				options={CURRENCIES.map((c) => ({ value: c, label: c }))}
				error={shown.priceCurrency}
			/>
		</div>
		<Input
			label={t('events.capacity')}
			hint={t('events.capacityHint')}
			inputmode="numeric"
			{...field('capacity')}
		/>
		<div class="grid gap-4 sm:grid-cols-2">
			<Input
				type="datetime-local"
				label={t('events.registrationOpensAt')}
				hint={t('events.registrationHint')}
				{...field('registrationOpensAt')}
			/>
			<Input
				type="datetime-local"
				label={t('events.registrationClosesAt')}
				{...field('registrationClosesAt')}
			/>
		</div>
	</FormSection>
	<FormSection title={t('events.section.publication')}>
		{#if statusLocked}
			<input type="hidden" name="status" value="draft" />
		{:else}
			<Select
				label={t('pages.status')}
				name="status"
				value={values.status ?? 'draft'}
				options={eventFormStatuses.map((s) => ({ value: s, label: t(`events.status.${s}`) }))}
				error={shown.status}
			/>
			<Input
				type="datetime-local"
				label={t('news.publishedAt')}
				hint={t('events.publishedAtHint')}
				{...field('publishedAt')}
			/>
		{/if}
	</FormSection>
</FormLayout>
