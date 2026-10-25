<script lang="ts">
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import { newsDate } from '#lib/components/site/news-date.ts';
	import Button from '#lib/components/ui/Button.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import { TRACKING_NOTE_MAX } from '#lib/validation/shop-limits.ts';
	import OrderStatusBadge from '#lib/components/shop/OrderStatusBadge.svelte';
	import { optionsText } from '#lib/components/shop/order-lines.ts';
	import type { PageProps } from './$types';

	/* docs/05 section 15: lines with options, delivery data, the member comment; a status forward
	 * (each sends a letter), the shipping note, the cancel with a refund (admin, before shipping). */
	let { data, form }: PageProps = $props();
	const order = $derived(data.order);
	let cancelOpen = $state(false);
	const cancellable = $derived(
		data.canCancel && (order.status === 'new' || order.status === 'confirmed')
	);
	const flow = ['new', 'confirmed', 'shipped', 'delivered'] as const;
	const forward = flow.slice(1) as Exclude<(typeof flow)[number], 'new'>[];
	const next = $derived(forward.slice(flow.indexOf(order.status as (typeof flow)[number])));
	const open = $derived(order.status !== 'cancelled' && order.status !== 'delivered');
	const delivery = $derived([
		[t('shop.order.recipient'), order.recipientName],
		[t('shop.order.phone'), order.phone],
		[t('shop.order.city'), order.city],
		[t('shop.order.address'), order.address]
	]);
</script>

<svelte:head>
	<title>{t('shop.order.title', { number: order.number })} — {t('admin.title')}</title>
</svelte:head>

<a
	href="/admin/orders"
	class="mb-2 inline-block text-sm text-navy-700 underline-offset-2 hover:underline"
	>{t('shop.order.back')}</a
>
<div class="mb-2 flex flex-wrap items-center gap-3">
	<h1 class="text-2xl font-bold">{t('shop.order.title', { number: order.number })}</h1>
	<OrderStatusBadge status={order.status} />
</div>
<p class="mb-6 text-sm text-ink-700">
	{t('shop.order.placed', { date: newsDate(order.createdAt, currentLocale()) })} ·
	<a class="text-navy-700 underline" href="/admin/users/{order.userId}">{order.memberName}</a>
</p>

{#if form && 'saved' in form}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t('users.saved')}
	</p>
{:else if form && 'badStatus' in form}
	<p role="alert" class="mb-4 rounded-md bg-error-bg p-3 text-sm text-error-fg">
		{t('shop.error.status')}
	</p>
{/if}

<div class="flex flex-col gap-6">
	<FormSection title={t('shop.order.lines')}>
		<ul class="flex flex-col gap-2">
			{#each order.lines as line, i (i)}
				<li class="flex flex-wrap justify-between gap-2 border-b border-line pb-2">
					<span>
						<a class="font-bold text-navy-700 underline" href="/admin/products/{line.itemId}"
							>{pickLocalized(line.title, currentLocale())}</a
						>
						{#if line.selectedOptions}
							<span class="block text-sm text-ink-700">{optionsText(line.selectedOptions)}</span>
						{/if}
					</span>
					<span class="text-sm whitespace-nowrap">
						{t('shop.order.linePrice', {
							points: line.pricePointsSnapshot,
							quantity: line.quantity
						})}
					</span>
				</li>
			{/each}
		</ul>
		<p class="font-bold">{t('shop.order.total', { points: order.totalPoints })}</p>
	</FormSection>

	<FormSection title={t('shop.order.delivery')}>
		<dl class="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
			{#each delivery as [label, value] (label)}
				<dt class="text-sm font-bold text-ink-700">{label}</dt>
				<dd>{value}</dd>
			{/each}
			<dt class="text-sm font-bold text-ink-700">{t('shop.order.comment')}</dt>
			<dd class="whitespace-pre-line">{order.comment ?? t('shop.order.noComment')}</dd>
		</dl>
	</FormSection>

	<FormSection title={t('shop.order.statusTitle')}>
		{#if open}
			<p class="text-sm text-ink-700">{t('shop.order.statusHint')}</p>
			<div class="flex flex-wrap gap-2">
				{#each next as status (status)}
					<form method="POST" action="?/status">
						<input type="hidden" name="status" value={status} />
						<Button type="submit" variant="secondary" size="sm"
							>{t(`shop.order.mark.${status}`)}</Button
						>
					</form>
				{/each}
			</div>
		{:else}
			<p class="text-sm text-ink-700">{t('shop.order.closed')}</p>
		{/if}
	</FormSection>

	{#if order.status !== 'cancelled'}
		<FormSection title={t('shop.order.tracking')}>
			<form method="POST" action="?/tracking" class="flex flex-col gap-3">
				<Input
					label={t('shop.order.tracking')}
					hint={t('shop.order.trackingHint')}
					name="trackingNote"
					value={order.trackingNote ?? ''}
					maxlength={TRACKING_NOTE_MAX}
					error={form && 'badNote' in form ? t('auth.error.tooLong') : undefined}
				/>
				<div><Button type="submit" size="sm">{t('shop.order.trackingSave')}</Button></div>
			</form>
		</FormSection>
	{/if}

	{#if cancellable}
		<FormSection title={t('shop.order.cancelTitle')}>
			<p class="text-sm text-ink-700">{t('shop.order.cancelHint')}</p>
			<div>
				<Button variant="danger" size="sm" onclick={() => (cancelOpen = true)}
					>{t('shop.order.cancel')}</Button
				>
			</div>
		</FormSection>
	{/if}
</div>

<ConfirmDialog
	bind:open={cancelOpen}
	title={t('shop.order.cancelTitle')}
	text={t('shop.order.cancelText', { number: order.number, points: order.totalPoints })}
	action="?/cancel"
	confirmLabel={t('shop.order.cancelConfirm')}
	danger
/>
