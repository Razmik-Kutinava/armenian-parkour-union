<script lang="ts">
	import Megaphone from '@lucide/svelte/icons/megaphone';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import FilterBar, { type Filter } from '#lib/components/admin/FilterBar.svelte';
	import Pagination from '#lib/components/admin/Pagination.svelte';
	import { newsDate } from '#lib/components/site/news-date.ts';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const statuses = ['draft', 'open', 'finished', 'cancelled'] as const;
	const columns = $derived<Column[]>([
		{ key: 'title', label: t('volunteer.requests.col.title') },
		{ key: 'event', label: t('volunteer.requests.col.event') },
		{ key: 'starts', label: t('volunteer.requests.col.starts') },
		{ key: 'places', label: t('volunteer.requests.col.places') },
		{ key: 'respondBy', label: t('volunteer.requests.col.respondBy') },
		{ key: 'status', label: t('volunteer.requests.col.status') }
	]);
	const filters = $derived<Filter[]>([
		{
			key: 'status',
			label: t('volunteer.requests.col.status'),
			options: [
				{ value: 'all', label: t('volunteer.requests.status.all') },
				...statuses.map((s) => ({ value: s, label: t(`volunteer.requests.status.${s}`) }))
			]
		}
	]);
	const day = (d: Date) => newsDate(d, currentLocale());
</script>

<svelte:head><title>{t('admin.nav.volunteerRequests')} — {t('admin.title')}</title></svelte:head>

<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-bold">{t('admin.nav.volunteerRequests')}</h1>
	<a class="btn btn-primary" href="/admin/volunteer/requests/new"
		>{t('volunteer.requests.create')}</a
	>
</div>

<FilterBar {filters} state={data.state} searchLabel="" />

<DataTable rows={data.rows} {columns} caption={t('admin.nav.volunteerRequests')} state={data.state}>
	{#snippet cell(row, column)}
		{#if column.key === 'title'}
			<a
				class="font-bold text-navy-700 underline-offset-2 hover:underline"
				href="/admin/volunteer/requests/{row.id}">{pickLocalized(row.title, currentLocale())}</a
			>
		{:else if column.key === 'event'}
			{row.eventTitle ? pickLocalized(row.eventTitle, currentLocale()) : '—'}
		{:else if column.key === 'starts'}
			{day(row.startsAt)}
		{:else if column.key === 'places'}
			{row.accepted} / {row.places}
		{:else if column.key === 'respondBy'}
			{day(row.respondBy)}
		{:else if column.key === 'status'}
			{t(`volunteer.requests.status.${row.status}`)}
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={Megaphone} title={t('volunteer.requests.empty')} />
	{/snippet}
</DataTable>
<div class="mt-4"><Pagination total={data.total} current={data.state.page} /></div>
