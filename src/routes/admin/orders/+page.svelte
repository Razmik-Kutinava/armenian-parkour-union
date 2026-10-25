<script lang="ts">
	import Package from '@lucide/svelte/icons/package';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import FilterBar, { type Filter } from '#lib/components/admin/FilterBar.svelte';
	import Pagination from '#lib/components/admin/Pagination.svelte';
	import { newsDate } from '#lib/components/site/news-date.ts';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { lineText } from './lines';
	import OrderStatusBadge from './OrderStatusBadge.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 15: number, member, items, total, status, date; filters — status, period. */
	let { data }: PageProps = $props();
	const statuses = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const;
	const columns = $derived<Column[]>([
		{ key: 'number', label: t('shop.orders.col.number'), class: 'whitespace-nowrap' },
		{ key: 'member', label: t('shop.orders.col.member') },
		{ key: 'lines', label: t('shop.orders.col.lines') },
		{ key: 'total', label: t('shop.orders.col.total'), class: 'whitespace-nowrap' },
		{ key: 'status', label: t('shop.orders.col.status') },
		{ key: 'date', label: t('shop.orders.col.date'), class: 'whitespace-nowrap' }
	]);
	const filters = $derived<Filter[]>([
		{
			key: 'status',
			label: t('shop.orders.col.status'),
			options: statuses.map((s) => ({ value: s, label: t(`shop.order.status.${s}`) }))
		},
		{ key: 'from', label: t('shop.orders.filter.from'), type: 'date' },
		{ key: 'to', label: t('shop.orders.filter.to'), type: 'date' }
	]);
</script>

<svelte:head><title>{t('admin.nav.orders')} — {t('admin.title')}</title></svelte:head>

<h1 class="mb-6 text-2xl font-bold">{t('admin.nav.orders')}</h1>

<FilterBar {filters} state={data.state} searchLabel={t('shop.orders.search')} />

<DataTable rows={data.rows} {columns} caption={t('admin.nav.orders')} state={data.state}>
	{#snippet cell(row, column)}
		{#if column.key === 'number'}
			<a
				class="font-bold text-navy-700 underline-offset-2 hover:underline"
				href="/admin/orders/{row.id}">{row.number}</a
			>
		{:else if column.key === 'member'}
			<a class="text-navy-700 underline-offset-2 hover:underline" href="/admin/users/{row.userId}"
				>{row.memberName}</a
			>
		{:else if column.key === 'lines'}
			<ul>
				{#each row.lines as line, i (i)}<li>{lineText(line, currentLocale())}</li>{/each}
			</ul>
		{:else if column.key === 'total'}{t('shop.points', { points: row.totalPoints })}
		{:else if column.key === 'status'}<OrderStatusBadge status={row.status} />
		{:else if column.key === 'date'}{newsDate(row.createdAt, currentLocale())}
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={Package} title={t('shop.orders.empty')} />
	{/snippet}
</DataTable>

<div class="mt-4"><Pagination total={data.total} current={data.state.page} /></div>
