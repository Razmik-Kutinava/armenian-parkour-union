<script lang="ts">
	import FormLayout from '#lib/components/admin/FormLayout.svelte';
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import LocalizedInput from '#lib/components/admin/LocalizedInput.svelte';
	import Checkbox from '#lib/components/ui/Checkbox.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { locales } from '#lib/i18n/locales.ts';
	import type { PageProps } from './$types';

	/* docs/05 section 13: the code is bound to the services and is only shown. */
	let { data, form }: PageProps = $props();
	const stored = $derived({
		...Object.fromEntries(locales.map((l) => [`title.${l}`, data.rule.title[l] ?? ''])),
		points: String(data.rule.points),
		isActive: data.rule.isActive ? 'on' : ''
	});
	const values = $derived<Record<string, string | undefined>>(form?.values ?? stored);
	const errors = $derived(
		Object.fromEntries(
			Object.entries((form && 'errors' in form && form.errors) || {}).map(([k, v]) => [
				k,
				v && t(v)
			])
		)
	);
</script>

<svelte:head><title>{data.rule.code} — {t('admin.title')}</title></svelte:head>

<h1 class="mb-1 text-2xl font-bold">{data.rule.title.en}</h1>
<p class="font-mono mb-6 text-sm text-ink-700">{t('pointRules.code', { code: data.rule.code })}</p>
{#if form?.saved}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t('pointRules.saved')}
	</p>
{:else if form && 'errors' in form}
	<p role="alert" class="mb-4 rounded-md bg-error-bg p-3 text-sm text-error-fg">
		{t('settings.fixErrors')}
	</p>
{/if}

<FormLayout cancelHref="/admin/point-rules" novalidate>
	<FormSection title={t('pointRules.title')}>
		<LocalizedInput name="title" label={t('pointRules.title')} {values} {errors} required />
		<Input
			label={t('pointRules.points')}
			name="points"
			inputmode="numeric"
			hint={t('pointRules.pointsHint')}
			value={values.points ?? ''}
			error={errors.points}
			required
		/>
		<Checkbox label={t('pointRules.active')} name="isActive" checked={values.isActive === 'on'} />
	</FormSection>
</FormLayout>
