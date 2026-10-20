<script lang="ts">
	import Wallet from '@lucide/svelte/icons/wallet';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import FilterBar, { type Filter } from '#lib/components/admin/FilterBar.svelte';
	import Pagination from '#lib/components/admin/Pagination.svelte';
	import StatusBadge from '#lib/components/payments/StatusBadge.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { formatPrice } from '#lib/money.ts';
	import ExportPanel from './ExportPanel.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 16: list with filters in the URL; "needs review" is one of them. */
	let { data }: PageProps = $props();

	const kinds = ['membership', 'donation', 'event_fee'] as const;
	const statuses = ['pending', 'paid', 'failed', 'cancelled', 'refunded'] as const;
	const columns = $derived<Column[]>([
		{ key: 'createdAt', label: t('payments.col.date'), sortable: true, class: 'whitespace-nowrap' },
		{ key: 'payer', label: t('payments.col.payer') },
		{ key: 'kind', label: t('payments.col.kind') },
		{ key: 'amount', label: t('payments.col.amount'), sortable: true, class: 'text-right' },
		{ key: 'status', label: t('payments.col.status') },
		{ key: 'provider', label: t('payments.col.provider') }
	]);
	const filters = $derived<Filter[]>([
		{
			key: 'kind',
			label: t('payments.col.kind'),
			options: kinds.map((k) => ({ value: k, label: t(`payment.kind.${k}`) }))
		},
		{
			key: 'status',
			label: t('payments.col.status'),
			options: statuses.map((s) => ({ value: s, label: t(`payments.status.${s}`) }))
		},
		{
			key: 'provider',
			label: t('payments.col.provider'),
			options: data.providers.map((p) => ({ value: p, label: p }))
		},
		{
			key: 'review',
			label: t('payments.filter.review'),
			options: [{ value: '1', label: t('payments.filter.reviewOnly') }]
		},
		{ key: 'from', label: t('payments.filter.from'), type: 'date' },
		{ key: 'to', label: t('payments.filter.to'), type: 'date' }
	]);
	const when = (d: Date) => d.toLocaleString(currentLocale());
</script>

<svelte:head><title>{t('admin.nav.payments')} — {t('admin.title')}</title></svelte:head>

<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-bold">{t('admin.nav.payments')}</h1>
	{#if data.canManage}
		<a
			href="/admin/payments/new"
			class="text-white inline-flex min-h-11 items-center rounded-md bg-navy-700 px-4 font-bold hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 sm:min-h-10"
			>{t('payments.new')}</a
		>
	{/if}
</div>

<ExportPanel />
<FilterBar {filters} state={data.state} searchLabel={t('payments.search')} />

<DataTable rows={data.rows} {columns} caption={t('admin.nav.payments')} state={data.state}>
	{#snippet cell(row, column)}
		{#if column.key === 'createdAt'}{when(row.createdAt)}
		{:else if column.key === 'payer'}
			<a
				class="font-bold text-navy-700 underline-offset-2 hover:underline"
				href="/admin/payments/{row.id}">{row.payerName ?? t('payments.guest')}</a
			>
			{#if row.needsReview}<Badge tone="warning">{t('payments.needsReview')}</Badge>{/if}
		{:else if column.key === 'kind'}{t(`payment.kind.${row.kind}`)}
		{:else if column.key === 'amount'}{formatPrice(row.amountMinor, row.currency, currentLocale())}
		{:else if column.key === 'status'}<StatusBadge status={row.status} />
		{:else if column.key === 'provider'}<span class="font-mono text-xs">{row.provider}</span>
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={Wallet} title={t('payments.empty')} />
	{/snippet}
</DataTable>

<div class="mt-4"><Pagination total={data.total} current={data.state.page} /></div>
