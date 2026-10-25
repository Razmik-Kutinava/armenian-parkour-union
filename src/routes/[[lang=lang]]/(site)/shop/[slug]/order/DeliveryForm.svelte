<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';
	import { controlClass } from '#lib/components/ui/control.ts';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { FieldErrors } from '#lib/validation/form.ts';
	import { DELIVERY_LIMITS } from '#lib/validation/shop-order.ts';

	/* docs/06 section 4.7: options and the delivery form; the server checks both again. */
	type Props = {
		itemOptions: { name: string; values: string[] }[];
		chosen: Record<string, string>;
		values: Record<string, string>;
		errors: FieldErrors;
	};
	let { itemOptions, chosen, values, errors }: Props = $props();
	const err = (field: string) => {
		const key = errors[field];
		return key ? t(key) : undefined;
	};
</script>

<form method="POST" action="?/review" class="flex flex-col gap-4">
	{#each itemOptions as option (option.name)}
		<Select
			label={option.name}
			name="option.{option.name}"
			required
			value={chosen[option.name] ?? ''}
			placeholder={t('shop.choose')}
			options={option.values.map((value) => ({ value, label: value }))}
		/>
	{/each}
	{#if errors.options}
		<p role="alert" class="text-sm text-error-fg">{t(errors.options)}</p>
	{/if}

	<h2 class="mt-2 text-xl font-bold text-ink-900">{t('shop.checkout.delivery')}</h2>
	<Input
		label={t('shop.order.recipient')}
		name="recipientName"
		autocomplete="name"
		required
		maxlength={DELIVERY_LIMITS.recipientName}
		value={values.recipientName ?? ''}
		error={err('recipientName')}
	/>
	<Input
		label={t('shop.order.phone')}
		name="phone"
		type="tel"
		autocomplete="tel"
		required
		maxlength={20}
		value={values.phone ?? ''}
		error={err('phone')}
	/>
	<Input
		label={t('shop.order.city')}
		name="city"
		autocomplete="address-level2"
		required
		maxlength={DELIVERY_LIMITS.city}
		value={values.city ?? ''}
		error={err('city')}
	/>
	<Input
		label={t('shop.order.address')}
		name="address"
		autocomplete="street-address"
		required
		maxlength={DELIVERY_LIMITS.address}
		value={values.address ?? ''}
		error={err('address')}
	/>
	<label class="flex flex-col gap-1 text-sm font-bold text-ink-900">
		{t('shop.checkout.comment')}
		<textarea
			name="comment"
			rows="3"
			maxlength={DELIVERY_LIMITS.comment}
			value={values.comment ?? ''}
			class="{controlClass} h-auto px-3 py-2 font-normal"></textarea>
		{#if err('comment')}<span class="font-normal text-error-fg">{err('comment')}</span>{/if}
	</label>
	<div><Button type="submit">{t('shop.checkout.continue')}</Button></div>
</form>
