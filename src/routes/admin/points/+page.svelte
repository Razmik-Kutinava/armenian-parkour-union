<script lang="ts">
	import Coins from '@lucide/svelte/icons/coins';
	import { page } from '$app/state';
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import FilterBar, { type Filter } from '#lib/components/admin/FilterBar.svelte';
	import Pagination from '#lib/components/admin/Pagination.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { POINTS_REASONS } from '#lib/validation/admin-points.ts';
	import LedgerCell from './LedgerCell.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 12: the ledger is never edited; a mistake is reversed by a new entry. */
	let { data, form }: PageProps = $props();

	const columns = $derived<Column[]>([
		{ key: 'createdAt', label: t('points.col.date'), sortable: true, class: 'whitespace-nowrap' },
		{ key: 'member', label: t('points.col.member') },
		{ key: 'delta', label: t('points.col.delta'), sortable: true, class: 'text-right' },
		{ key: 'reason', label: t('points.col.reason') },
		{ key: 'source', label: t('points.col.source') },
		{ key: 'comment', label: t('points.col.comment') },
		{ key: 'author', label: t('points.col.author') },
		...(data.canAdjust ? [{ key: 'actions', label: t('points.col.actions') }] : [])
	]);
	const filters = $derived<Filter[]>([
		{
			key: 'reason',
			label: t('points.col.reason'),
			options: POINTS_REASONS.map((r) => ({ value: r, label: t(`points.reason.${r}`) }))
		},
		{ key: 'from', label: t('points.filter.from'), type: 'date' },
		{ key: 'to', label: t('points.filter.to'), type: 'date' },
		{
			key: 'manual',
			label: t('points.filter.manual'),
			options: [{ value: '1', label: t('points.filter.manualOnly') }]
		},
		{ key: 'over', label: t('points.filter.over'), type: 'number' }
	]);
	type Row = (typeof data.rows)[number];
	let target = $state<Row | null>(null);
	let reverseOpen = $state(false);
	const reverse = (row: Row) => {
		target = row;
		reverseOpen = true;
	};
	/* The action keeps the filters: the list after the reversal is the same list. */
	const reverseAction = $derived(`?/reverse&${page.url.searchParams}`);
	const exportHref = $derived(`/admin/points/export?${page.url.searchParams}`);
	const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
</script>

<svelte:head><title>{t('admin.nav.points')} — {t('admin.title')}</title></svelte:head>

<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-bold">{t('admin.nav.points')}</h1>
	{#if data.canAdjust}
		<div class="flex flex-wrap gap-3">
			<a
				href={exportHref}
				class="inline-flex min-h-11 items-center rounded-md border border-navy-700 px-4 font-bold text-navy-700 hover:bg-navy-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 sm:min-h-10"
				>{t('points.export')}</a
			>
			<a
				href="/admin/points/new"
				class="text-white inline-flex min-h-11 items-center rounded-md bg-navy-700 px-4 font-bold hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 sm:min-h-10"
				>{t('points.adjust')}</a
			>
		</div>
	{/if}
</div>

{#if form?.reversed}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t('points.reversedDone', { balance: String(form.reversed.balance) })}
	</p>
{:else if form?.message}
	<p role="alert" class="mb-4 rounded-md bg-error-bg p-3 text-sm text-error-fg">
		{t(form.message)}
	</p>
{/if}

<FilterBar {filters} state={data.state} searchLabel={t('points.search')} />

<DataTable rows={data.rows} {columns} caption={t('admin.nav.points')} state={data.state}>
	{#snippet cell(row, column)}
		{#if column.key === 'createdAt'}{row.createdAt.toLocaleString(currentLocale())}
		{:else if column.key === 'actions'}
			{#if row.reason !== 'reversal' && !row.reversedById}
				<Button size="sm" variant="secondary" onclick={() => reverse(row)}
					>{t('points.reverse')}</Button
				>
			{/if}
		{:else}<LedgerCell {row} key={column.key} />
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={Coins} title={t('points.empty')} />
	{/snippet}
</DataTable>

<div class="mt-4"><Pagination total={data.total} current={data.state.page} /></div>

{#if data.canAdjust}
	<ConfirmDialog
		bind:open={reverseOpen}
		title={t('points.reverseTitle')}
		text={t('points.reverseText', { delta: target ? signed(-target.delta) : '' })}
		action={reverseAction}
		confirmLabel={t('points.reverseConfirm')}
		danger
		comment="required"
	>
		{#snippet fields()}<input type="hidden" name="entryId" value={target?.id ?? ''} />{/snippet}
	</ConfirmDialog>
{/if}
