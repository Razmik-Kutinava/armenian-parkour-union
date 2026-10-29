<script lang="ts">
	import BookUser from '@lucide/svelte/icons/book-user';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import FilterBar, { type Filter } from '#lib/components/admin/FilterBar.svelte';
	import Pagination from '#lib/components/admin/Pagination.svelte';
	import { newsDate } from '#lib/components/site/news-date.ts';
	import Badge from '#lib/components/ui/Badge.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import CardStatus from './CardStatus.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 28 "Cards": pending by default, oldest on top; filters in the URL. */
	let { data }: PageProps = $props();

	const statuses = ['pending', 'active', 'rejected', 'revoked'] as const;
	const keys = ['member', 'number', 'status', 'age', 'membership', 'valid', 'streak', 'applied'];
	const columns = $derived<Column[]>(
		keys.map((key) => ({ key, label: t(`volunteerCards.col.${key as 'member'}`) }))
	);
	const filters = $derived<Filter[]>([
		{
			key: 'status',
			label: t('volunteerCards.col.status'),
			options: [
				...statuses.map((s) => ({ value: s, label: t(`volunteerCards.status.${s}`) })),
				{ value: 'all', label: t('volunteerCards.status.all') }
			]
		},
		{
			key: 'flagged',
			label: t('volunteerCards.filter.flagged'),
			options: [{ value: '1', label: t('volunteerCards.filter.flaggedOnly') }]
		},
		{
			key: 'valid',
			label: t('volunteerCards.col.valid'),
			options: [
				{ value: 'yes', label: t('volunteerCards.valid.yes') },
				{ value: 'no', label: t('volunteerCards.valid.no') }
			]
		}
	]);
	const day = (d: Date | null) => (d ? newsDate(d, currentLocale()) : '—');
</script>

<svelte:head><title>{t('admin.nav.volunteerCards')} — {t('admin.title')}</title></svelte:head>

<h1 class="mb-6 text-2xl font-bold">{t('admin.nav.volunteerCards')}</h1>

<FilterBar {filters} state={data.state} searchLabel={t('volunteerCards.search')} />

<DataTable rows={data.rows} {columns} caption={t('admin.nav.volunteerCards')} state={data.state}>
	{#snippet cell(row, column)}
		{#if column.key === 'member'}
			<a
				class="font-bold text-navy-700 underline-offset-2 hover:underline"
				href="/admin/volunteer/cards/{row.id}">{row.name}</a
			>
			{#if row.flagged}<Badge tone="warning">{t('volunteerCards.flagged')}</Badge>{/if}
		{:else if column.key === 'number'}{row.number ?? '—'}
		{:else if column.key === 'status'}<CardStatus status={row.status} />
		{:else if column.key === 'age'}{row.age ?? '—'}
		{:else if column.key === 'membership'}{day(row.paidUntil)}
		{:else if column.key === 'valid'}
			{#if row.validity.valid}{t('volunteerCards.valid.yes')}
			{:else}
				{t('volunteerCards.valid.no')}
				<p class="text-xs text-ink-700">
					{row.validity.reasons.map((r) => t(`volunteerCards.invalid.${r}`)).join(', ')}
				</p>
			{/if}
		{:else if column.key === 'streak'}{row.declineStreak}
		{:else if column.key === 'applied'}{day(row.appliedAt)}
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={BookUser} title={t('volunteerCards.empty')} />
	{/snippet}
</DataTable>

<div class="mt-4"><Pagination total={data.total} current={data.state.page} /></div>
