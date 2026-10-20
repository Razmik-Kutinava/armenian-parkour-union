<script lang="ts">
	import FormLayout from '#lib/components/admin/FormLayout.svelte';
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import Checkbox from '#lib/components/ui/Checkbox.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { CURRENCIES } from '#lib/money.ts';
	import type { PageProps } from './$types';

	/* docs/07 section 9, docs/05 section 16: a transfer outside the site, recorded as paid. */
	let { data, form }: PageProps = $props();
	const values: Record<string, string> = $derived(
		form?.values ?? { kind: 'donation', currency: 'AMD' }
	);
	const errors = $derived<Record<string, string | undefined>>(
		Object.fromEntries(Object.entries(form?.errors ?? {}).map(([k, v]) => [k, v && t(v)]))
	);
	let kind = $derived(values.kind ?? 'donation');
</script>

<svelte:head><title>{t('payments.new')} — {t('admin.title')}</title></svelte:head>

<h1 class="mb-6 text-2xl font-bold">{t('payments.new')}</h1>

<FormLayout cancelHref="/admin/payments" submitLabel={t('payments.form.submit')} novalidate>
	<FormSection title={t('payments.section.payment')}>
		<Select
			label={t('payments.form.kind')}
			name="kind"
			bind:value={kind}
			options={[
				{ value: 'donation', label: t('payment.kind.donation') },
				{ value: 'membership', label: t('payment.kind.membership') }
			]}
			error={errors.kind}
		/>
		<Input
			label={t('payments.form.amount')}
			name="amount"
			inputmode="decimal"
			value={values.amount ?? ''}
			error={errors.amount}
			required
		/>
		<Select
			label={t('payments.form.currency')}
			name="currency"
			value={values.currency ?? 'AMD'}
			options={CURRENCIES.map((c) => ({ value: c, label: c }))}
			error={errors.currency}
		/>
		<Input
			label={t('payments.form.paidOn')}
			name="paidOn"
			type="date"
			value={values.paidOn ?? ''}
			error={errors.paidOn}
			required
		/>
		<Input
			label={t('payments.form.comment')}
			name="comment"
			maxlength={1000}
			value={values.comment ?? ''}
			error={errors.comment}
			required
		/>
	</FormSection>
	<FormSection title={t('payments.section.payer')}>
		<Input
			label={t('payments.form.payerEmail')}
			name="payerEmail"
			type="email"
			hint={t('payments.form.payerHint')}
			value={values.payerEmail ?? ''}
			error={errors.payerEmail}
		/>
		{#if kind === 'donation'}
			<Input
				label={t('payments.form.donorName')}
				name="donorName"
				value={values.donorName ?? ''}
				error={errors.donorName}
			/>
			<Input
				label={t('payments.form.donorEmail')}
				name="donorEmail"
				type="email"
				value={values.donorEmail ?? ''}
				error={errors.donorEmail}
			/>
			<Checkbox
				label={t('payments.form.anonymous')}
				name="isAnonymous"
				checked={values.isAnonymous === 'on'}
			/>
			<Select
				label={t('payments.form.purpose')}
				name="purposeId"
				value={values.purposeId ?? ''}
				options={[
					{ value: '', label: t('payments.form.noPurpose') },
					...data.purposes.map((p) => ({ value: p.id, label: p.title }))
				]}
				error={errors.purposeId}
			/>
		{/if}
	</FormSection>
</FormLayout>
