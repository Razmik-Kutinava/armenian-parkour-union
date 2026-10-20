<script lang="ts">
	import StatusBadge from '#lib/components/payments/StatusBadge.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { formatPrice } from '#lib/money.ts';
	import HistoryTable from '../../users/[id]/HistoryTable.svelte';
	import PaymentActions from './PaymentActions.svelte';
	import PaymentDetails from './PaymentDetails.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const card = $derived(data.card);
</script>

<svelte:head><title>{t('payments.card.title')} — {t('admin.title')}</title></svelte:head>

<div class="mb-4 flex flex-wrap items-center gap-3">
	<h1 class="text-2xl font-bold">
		{t(`payment.kind.${card.kind}`)}: {formatPrice(
			card.amountMinor,
			card.currency,
			currentLocale()
		)}
	</h1>
	<StatusBadge status={card.status} />
	{#if card.needsReview}<Badge tone="warning">{t('payments.needsReview')}</Badge>{/if}
</div>

{#if form?.done}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t(form.done)}
	</p>
{:else if form?.message}
	<p role="alert" class="mb-4 rounded-md bg-error-bg p-3 text-sm text-error-fg">
		{t(form.message)}
	</p>
{:else if data.created}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t('payments.created')}
	</p>
{/if}

<div class="flex flex-col gap-6">
	{#if data.canManage}<PaymentActions {card} />{/if}
	<PaymentDetails {card} />
	<section class="flex flex-col gap-3">
		<h2 class="text-lg font-bold">{t('payments.section.history')}</h2>
		<HistoryTable entries={card.history} />
	</section>
</div>
