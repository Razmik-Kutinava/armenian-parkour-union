<script lang="ts">
	import FormLayout from '#lib/components/admin/FormLayout.svelte';
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { localeNames } from '#lib/i18n/locales.ts';
	import type { MessageKey } from '#lib/i18n/translate.ts';
	import SettingsTabs from '../SettingsTabs.svelte';
	import type { PageProps } from './$types';

	/* questions.md stage 6 (2026-10-26): `site_settings.certificates.signer` — under the PDF line. */
	let { data, form }: PageProps = $props();
	const values = $derived(form?.values ?? data.values);
	const errors = $derived<Partial<Record<string, MessageKey>>>(
		(form && 'errors' in form && form.errors) || {}
	);
	const languages = [
		{ suffix: 'Hy', locale: 'hy' },
		{ suffix: 'En', locale: 'en' },
		{ suffix: 'Ru', locale: 'ru' }
	] as const;
	const fields = (['name', 'title'] as const).flatMap((part) =>
		languages.map(({ suffix, locale }) => ({
			name: `${part}${suffix}` as const,
			label: t(`certificates.signer.${part}`, { language: localeNames[locale] })
		}))
	);
</script>

<svelte:head><title>{t('settings.tab.certificates')} — {t('admin.title')}</title></svelte:head>

<h1 class="mb-4 text-2xl font-bold">{t('admin.nav.settings')}</h1>
<SettingsTabs current="certificates" />

{#if form?.saved}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t('users.saved')}
	</p>
{:else if form && 'errors' in form}
	<p role="alert" class="mb-4 rounded-md bg-error-bg p-3 text-sm text-error-fg">
		{t('settings.fixErrors')}
	</p>
{/if}

<FormLayout cancelHref="/admin" novalidate>
	<FormSection title={t('certificates.signer.section')} text={t('certificates.signer.sectionHint')}>
		{#each fields as field (field.name)}
			<Input
				name={field.name}
				label={field.label}
				value={values[field.name]}
				error={errors[field.name] && t(errors[field.name]!)}
				maxlength={80}
			/>
		{/each}
	</FormSection>
</FormLayout>
