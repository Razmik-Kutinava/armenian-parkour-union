<script lang="ts">
	import CoverPicker from '#lib/components/admin/CoverPicker.svelte';
	import FormLayout from '#lib/components/admin/FormLayout.svelte';
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import LocalizedInput from '#lib/components/admin/LocalizedInput.svelte';
	import Checkbox from '#lib/components/ui/Checkbox.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { currentLocale, t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized, type LocalizedText } from '#lib/i18n/localized.ts';
	import { heroTypes } from '#lib/validation/hero-enums.ts';
	import PersonPicker from './PersonPicker.svelte';

	/*
	 * docs/05 section 4: type, texts ×3, background, the type's own field, button, period, switch.
	 * An empty select gets `undefined`: a choice made before hydration stays.
	 */
	type Props = {
		action?: string;
		values: Record<string, string | undefined>;
		errors?: Partial<Record<string, MessageKey>>;
		images: { key: string; name: string; url: string | null }[];
		events: { id: string; title: LocalizedText; status: string }[];
		personName: string | null;
	};
	let { action, values, errors = {}, images, events, personName }: Props = $props();
	const shown = $derived(
		Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v && t(v)]))
	);
	const field = (name: string) => ({ name, value: values[name] ?? '', error: shown[name] });
	let pickedEvent: string | null = $state(null);
	const eventId = $derived(pickedEvent ?? values.eventId ?? '');
	const draft = $derived(events.find((e) => e.id === eventId && e.status !== 'published'));
</script>

<FormLayout {action} cancelHref="/admin/hero" novalidate>
	<FormSection title={t('hero.section.main')}>
		<div class="hero-main flex flex-col gap-4">
			<Select
				label={t('hero.form.type')}
				name="type"
				value={values.type || undefined}
				options={[
					{ value: '', label: t('hero.error.type') },
					...heroTypes.map((v) => ({ value: v, label: t(`hero.type.${v}`) }))
				]}
				error={shown.type}
			/>
			<LocalizedInput name="title" label={t('hero.form.title')} {values} errors={shown} required />
			<LocalizedInput name="subtitle" label={t('hero.form.subtitle')} {values} errors={shown} />
			<CoverPicker
				name="mediaKey"
				label={t('hero.form.background')}
				value={values.mediaKey ?? ''}
				{images}
				error={shown.mediaKey}
				hint={t('hero.form.backgroundHint')}
			/>
			<div class="hero-type hero-type-event flex-col gap-4">
				<Select
					label={t('hero.form.event')}
					name="eventId"
					value={eventId || undefined}
					onchange={(e) => (pickedEvent = e.currentTarget.value)}
					options={[
						{ value: '', label: t('hero.form.eventPick') },
						...events.map((e) => ({
							value: e.id,
							label: pickLocalized(e.title, currentLocale())
						}))
					]}
					error={shown.eventId}
				/>
				{#if draft}<p class="-mt-2 text-sm text-warning-fg">{t('hero.form.eventDraft')}</p>{/if}
			</div>
			<div class="hero-type hero-type-person flex-col">
				<PersonPicker
					value={values.personUserId ?? ''}
					name={values.personName ?? personName ?? ''}
					error={shown.personUserId}
				/>
			</div>
			<div class="hero-type hero-type-video flex-col">
				<Input
					label={t('hero.form.video')}
					hint={t('hero.form.videoHint')}
					{...field('videoUrl')}
				/>
			</div>
		</div>
	</FormSection>
	<FormSection title={t('hero.section.button')}>
		<LocalizedInput name="ctaLabel" label={t('hero.form.ctaLabel')} {values} errors={shown} />
		<Input label={t('hero.form.ctaUrl')} hint={t('hero.form.ctaHint')} {...field('ctaUrl')} />
	</FormSection>
	<FormSection title={t('hero.section.show')}>
		<div class="grid gap-4 sm:grid-cols-2">
			<Input
				type="datetime-local"
				label={t('hero.form.startsAt')}
				hint={t('hero.form.periodHint')}
				{...field('startsAt')}
			/>
			<Input type="datetime-local" label={t('hero.form.endsAt')} {...field('endsAt')} />
		</div>
		<Checkbox
			label={t('hero.form.active')}
			name="isActive"
			checked={values.isActive === 'true' || values.isActive === 'on'}
		/>
	</FormSection>
</FormLayout>

<style>
	/* The type's own field follows the chosen option even before the scripts load. */
	.hero-type {
		display: none;
	}
	.hero-main:has(:global(option[value='event']:checked)) .hero-type-event,
	.hero-main:has(:global(option[value='person']:checked)) .hero-type-person,
	.hero-main:has(:global(option[value='video']:checked)) .hero-type-video {
		display: flex;
	}
</style>
