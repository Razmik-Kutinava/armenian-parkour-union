<script lang="ts">
	import FormLayout from '#lib/components/admin/FormLayout.svelte';
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import Checkbox from '#lib/components/ui/Checkbox.svelte';
	import { defaultLocale, localeNames, locales } from '#lib/i18n/locales.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import SettingsTabs from '../SettingsTabs.svelte';
	import type { PageProps } from './$types';

	/* `site_settings.locales`: the languages of the public site (docs/06 section 1 p. 2, 7.4). */
	let { data, form }: PageProps = $props();
	const enabled = $derived(form?.enabled ?? data.enabled);
</script>

<svelte:head><title>{t('settings.tab.languages')} — {t('admin.title')}</title></svelte:head>

<h1 class="mb-4 text-2xl font-bold">{t('admin.nav.settings')}</h1>
<SettingsTabs current="languages" />

{#if form?.saved}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t('users.saved')}
	</p>
{/if}

<FormLayout cancelHref="/admin" novalidate>
	<FormSection title={t('languages.settings.section')} text={t('languages.settings.sectionHint')}>
		<fieldset class="flex flex-col gap-1">
			<legend class="sr-only">{t('languages.settings.section')}</legend>
			{#each locales as locale (locale)}
				<Checkbox
					name="locales"
					value={locale}
					label={localeNames[locale]}
					lang={locale}
					checked={locale === defaultLocale || enabled.includes(locale)}
					disabled={locale === defaultLocale}
				/>
			{/each}
			<p class="text-sm text-ink-700">{t('languages.settings.englishAlways')}</p>
		</fieldset>
	</FormSection>
</FormLayout>
