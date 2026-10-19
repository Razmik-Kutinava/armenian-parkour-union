<script lang="ts">
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import { enhance } from '$app/forms';
	import Button from '#lib/components/ui/Button.svelte';
	import Checkbox from '#lib/components/ui/Checkbox.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { currentLocale, t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { formatPrice } from '#lib/money.ts';
	import { amountPresets } from './donation-presets';

	type Limits = { currency: string; minMinor: number; maxMinor: number };
	type FormState = {
		values?: Record<string, string>;
		errors?: Partial<Record<string, MessageKey>>;
		message?: MessageKey;
	} | null;

	/* docs/06 section 4.8. The currency is the one of the limits: the form does not send it. */
	let {
		limits,
		purposes,
		donor,
		form
	}: {
		limits: Limits;
		purposes: { id: string; title: string }[];
		donor: { name: string; email: string } | null;
		form?: FormState;
	} = $props();

	const price = (minor: number) => formatPrice(minor, limits.currency, currentLocale());
	const range = $derived({ min: price(limits.minMinor), max: price(limits.maxMinor) });
	let amount = $derived(form?.values?.amount ?? '');
	let submitting = $state(false);
	const err = (field: string) => {
		const key = form?.errors?.[field];
		return key ? t(key, range) : undefined;
	};
	const purposeOptions = $derived([
		{ value: '', label: t('donate.purpose.general') },
		...purposes.map((p) => ({ value: p.id, label: p.title }))
	]);
</script>

<form
	method="POST"
	action="?/donate"
	class="flex flex-col gap-4 rounded-md border border-line bg-surface p-5"
	novalidate
	use:enhance={() => {
		submitting = true;
		return async ({ result, update }) => {
			/* The provider page is usually on another site: client-side navigation cannot open it. */
			if (result.type === 'redirect') {
				window.location.assign(result.location);
				return;
			}
			await update({ reset: false });
			submitting = false;
		};
	}}
>
	{#if form?.message}
		<p role="alert" class="flex items-start gap-2 rounded-md bg-error-bg p-3 text-sm text-error-fg">
			<CircleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
			{t(form.message)}
		</p>
	{/if}
	<div class="flex flex-wrap gap-2" role="group" aria-label={t('donate.quick')}>
		{#each amountPresets(limits.minMinor, limits.maxMinor) as preset (preset)}
			<button
				type="button"
				class="rounded-md border border-line px-3 py-2 font-bold text-navy-700 hover:bg-navy-50"
				onclick={() => (amount = String(preset))}>{price(preset)}</button
			>
		{/each}
	</div>
	<Input
		label={t('donate.amount', { currency: limits.currency })}
		name="amount"
		inputmode="numeric"
		required
		bind:value={amount}
		hint={t('donate.range', range)}
		error={err('amount')}
	/>
	{#if purposes.length}
		<Select
			label={t('donate.purpose')}
			name="purposeId"
			options={purposeOptions}
			value={form?.values?.purposeId ?? ''}
			error={err('purposeId')}
		/>
	{/if}
	{#if donor}
		<p class="text-ink-700">{t('donate.from', donor)}</p>
	{:else}
		<Input
			label={t('donate.name')}
			name="donorName"
			autocomplete="name"
			required
			value={form?.values?.donorName ?? ''}
			error={err('donorName')}
		/>
		<Input
			label={t('auth.email')}
			name="donorEmail"
			type="email"
			autocomplete="email"
			required
			value={form?.values?.donorEmail ?? ''}
			error={err('donorEmail')}
		/>
	{/if}
	<Checkbox
		label={t('donate.anonymous')}
		name="isAnonymous"
		checked={form?.values?.isAnonymous === 'on'}
	/>
	<Button type="submit" loading={submitting} class="self-start">{t('donate.submit')}</Button>
</form>
