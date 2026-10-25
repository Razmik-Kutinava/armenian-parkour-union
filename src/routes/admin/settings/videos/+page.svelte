<script lang="ts">
	import FormLayout from '#lib/components/admin/FormLayout.svelte';
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import Checkbox from '#lib/components/ui/Checkbox.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { MessageKey } from '#lib/i18n/translate.ts';
	import SettingsTabs from '../SettingsTabs.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 21 "Rule parameters": `site_settings.videos` (decisions.md 2026-10-24, 7.1). */
	let { data, form }: PageProps = $props();
	const values = $derived(form?.values ?? data.values);
	const errors = $derived<Partial<Record<string, MessageKey>>>(
		(form && 'errors' in form && form.errors) || {}
	);
	const platforms = ['youtube', 'instagram'] as const;
</script>

<svelte:head><title>{t('settings.tab.videos')} — {t('admin.title')}</title></svelte:head>

<h1 class="mb-4 text-2xl font-bold">{t('admin.nav.settings')}</h1>
<SettingsTabs current="videos" />

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
	<FormSection title={t('videos.settings.section')} text={t('videos.settings.sectionHint')}>
		<Input
			name="monthlyLimit"
			label={t('videos.settings.limit')}
			hint={t('videos.settings.limitHint')}
			value={values.monthlyLimit}
			error={errors.monthlyLimit && t(errors.monthlyLimit)}
			inputmode="numeric"
			required
		/>
		<fieldset class="flex flex-col gap-1">
			<legend class="mb-1 text-sm font-bold text-ink-900">{t('videos.settings.platforms')}</legend>
			{#each platforms as p (p)}
				<Checkbox
					name="platforms"
					value={p}
					label={t(`videos.platform.${p}`)}
					checked={values.platforms.includes(p)}
				/>
			{/each}
			{#if errors.platforms}
				<p class="text-sm text-error-fg">{t(errors.platforms)}</p>
			{/if}
		</fieldset>
	</FormSection>
</FormLayout>
