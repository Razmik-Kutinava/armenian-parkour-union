<script lang="ts">
	import FormLayout from '#lib/components/admin/FormLayout.svelte';
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { CURRENCIES } from '#lib/money.ts';
	import SettingsTabs from '../SettingsTabs.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 21 "Membership"; donation limits and payment wait — decisions.md 2026-10-19. */
	let { data, form }: PageProps = $props();
	const values: Record<string, string> = $derived(form?.values ?? data.values);
	const errors = $derived<Record<string, string | undefined>>(
		Object.fromEntries(
			Object.entries((form && 'errors' in form && form.errors) || {}).map(([k, v]) => [
				k,
				v && t(v)
			])
		)
	);
	const currencies = CURRENCIES.map((c) => ({ value: c, label: c }));
	const field = (name: string, label: string, hint?: string) => ({
		name,
		label,
		hint,
		value: values[name] ?? '',
		error: errors[name]
	});
</script>

<svelte:head><title>{t('settings.tab.payments')} — {t('admin.title')}</title></svelte:head>

<h1 class="mb-4 text-2xl font-bold">{t('admin.nav.settings')}</h1>
<SettingsTabs current="payments" />

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
	<FormSection title={t('settings.fee')} text={t('settings.feeHint')}>
		<div class="grid gap-4 sm:grid-cols-3">
			<Input {...field('feeAmount', t('settings.feeAmount'))} inputmode="decimal" required />
			<Select
				{...field('feeCurrency', t('settings.feeCurrency'))}
				value={values.feeCurrency ?? 'AMD'}
				options={currencies}
			/>
			<Input
				{...field('feePeriodMonths', t('settings.feePeriod'), t('settings.feePeriodHint'))}
				inputmode="numeric"
				required
			/>
		</div>
	</FormSection>
	<FormSection title={t('settings.donations')} text={t('settings.donationsHint')}>
		<div class="grid gap-4 sm:grid-cols-3">
			<Select
				{...field('donationCurrency', t('settings.donationCurrency'))}
				value={values.donationCurrency ?? 'AMD'}
				options={currencies}
			/>
			<Input {...field('donationMin', t('settings.donationMin'))} inputmode="decimal" required />
			<Input {...field('donationMax', t('settings.donationMax'))} inputmode="decimal" required />
		</div>
	</FormSection>
	<FormSection title={t('settings.payment')}>
		<Input
			{...field('waitMinutes', t('settings.waitMinutes'), t('settings.waitHint'))}
			inputmode="numeric"
			required
		/>
	</FormSection>
</FormLayout>
