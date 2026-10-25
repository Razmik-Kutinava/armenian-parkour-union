<script lang="ts">
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import FilterBar, { type Filter } from '#lib/components/admin/FilterBar.svelte';
	import Pagination from '#lib/components/admin/Pagination.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import { itemStatuses } from '#lib/validation/shop-limits.ts';
	import ItemStatusBadge from './ItemStatusBadge.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 14: photo, title, price in points, stock, status. */
	let { data }: PageProps = $props();
	const columns = $derived<Column[]>([
		{ key: 'photo', label: t('shop.items.col.photo') },
		{ key: 'title', label: t('shop.items.col.title') },
		{ key: 'price', label: t('shop.items.col.price'), class: 'whitespace-nowrap' },
		{ key: 'stock', label: t('shop.items.col.stock') },
		{ key: 'status', label: t('shop.items.col.status') }
	]);
	const filters = $derived<Filter[]>([
		{
			key: 'status',
			label: t('shop.items.col.status'),
			options: itemStatuses.map((s) => ({ value: s, label: t(`shop.item.status.${s}`) }))
		},
		{
			key: 'stock',
			label: t('shop.items.filter.stock'),
			options: [{ value: 'out', label: t('shop.items.stock.out') }]
		}
	]);
</script>

<svelte:head><title>{t('admin.nav.products')} — {t('admin.title')}</title></svelte:head>

<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-bold">{t('admin.nav.products')}</h1>
	<a
		href="/admin/products/new"
		class="text-white inline-flex min-h-11 items-center rounded-md bg-navy-700 px-4 font-bold hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 sm:min-h-10"
		>{t('shop.items.create')}</a
	>
</div>

<FilterBar {filters} state={data.state} searchLabel={t('shop.items.search')} />

<DataTable rows={data.rows} {columns} caption={t('admin.nav.products')} state={data.state}>
	{#snippet cell(row, column)}
		{#if column.key === 'photo'}
			<div class="size-12 overflow-hidden rounded-sm bg-navy-100">
				{#if row.photoUrl}<img src={row.photoUrl} alt="" class="size-full object-cover" />{/if}
			</div>
		{:else if column.key === 'title'}
			<a
				class="font-bold text-navy-700 underline-offset-2 hover:underline"
				href="/admin/products/{row.id}">{pickLocalized(row.title, currentLocale())}</a
			>
		{:else if column.key === 'price'}{t('shop.points', { points: row.pricePoints })}
		{:else if column.key === 'stock'}{row.stock === null
				? t('shop.items.noLimit')
				: row.stock === 0
					? t('shop.items.stock.out')
					: row.stock}
		{:else if column.key === 'status'}<ItemStatusBadge status={row.status} />
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={ShoppingBag} title={t('shop.items.empty')} />
	{/snippet}
</DataTable>

<div class="mt-4"><Pagination total={data.total} current={data.state.page} /></div>
