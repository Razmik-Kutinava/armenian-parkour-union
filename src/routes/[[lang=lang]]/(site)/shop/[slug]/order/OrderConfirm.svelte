<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { DeliveryValues } from '#lib/validation/shop-order.ts';

	/* docs/06 section 4.7: the confirmation step. The values go back as hidden fields; the order id
	 * makes a second click place the same order (docs/todo.md 7.6, decision 4). */
	type Props = {
		title: string;
		confirm: {
			orderId: string;
			delivery: DeliveryValues;
			options: Record<string, string>;
			price: number;
			balanceAfter: number;
		};
	};
	let { title, confirm }: Props = $props();
	const optionsText = $derived(
		Object.entries(confirm.options)
			.map(([name, value]) => `${name}: ${value}`)
			.join(', ')
	);
	const d = $derived(confirm.delivery);
	const rows = $derived([
		[t('shop.order.recipient'), d.recipientName],
		[t('shop.order.phone'), d.phone],
		[t('shop.order.city'), d.city],
		[t('shop.order.address'), d.address]
	]);
	const label = 'text-sm font-bold text-ink-700';
</script>

<section class="flex flex-col gap-4">
	<h2 class="text-xl font-bold text-ink-900">{t('shop.checkout.check')}</h2>
	<dl class="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
		<dt class={label}>{t('shop.checkout.product')}</dt>
		<dd>{title}</dd>
		{#if optionsText}
			<dt class={label}>{t('shop.checkout.options')}</dt>
			<dd>{optionsText}</dd>
		{/if}
		<dt class={label}>{t('shop.checkout.price')}</dt>
		<dd>{t('shop.points', { points: confirm.price })}</dd>
		{#each rows as [name, value] (name)}
			<dt class={label}>{name}</dt>
			<dd>{value}</dd>
		{/each}
		{#if d.comment}
			<dt class={label}>{t('shop.checkout.comment')}</dt>
			<dd class="whitespace-pre-line">{d.comment}</dd>
		{/if}
	</dl>
	<p class="font-bold text-navy-900">
		{t('shop.checkout.balanceAfter', { points: confirm.balanceAfter })}
	</p>
	<form method="POST" action="?/place" class="flex flex-wrap gap-3">
		<input type="hidden" name="orderId" value={confirm.orderId} />
		{#each Object.entries(confirm.options) as [name, value] (name)}
			<input type="hidden" name="option.{name}" {value} />
		{/each}
		{#each Object.entries(d) as [name, value] (name)}
			<input type="hidden" {name} value={value ?? ''} />
		{/each}
		<Button type="submit">{t('shop.checkout.confirm', { points: confirm.price })}</Button>
		<Button type="submit" variant="secondary" formaction="?/edit" formnovalidate
			>{t('shop.checkout.edit')}</Button
		>
	</form>
</section>
