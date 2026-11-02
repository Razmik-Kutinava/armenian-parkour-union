<script lang="ts">
	import Camera from '@lucide/svelte/icons/camera';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import FilterBar, { type Filter } from '#lib/components/admin/FilterBar.svelte';
	import Pagination from '#lib/components/admin/Pagination.svelte';
	import { newsDate } from '#lib/components/site/news-date.ts';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized, type LocalizedText } from '#lib/i18n/localized.ts';
	import type { PageProps } from './$types';

	/* docs/05 section 28 "Reports": pending by default, oldest on top. */
	let { data }: PageProps = $props();
	const local = (text: LocalizedText) => pickLocalized(text, currentLocale());
	const statuses = ['pending', 'approved', 'rejected'] as const;
	const columns = $derived<Column[]>(
		(['member', 'request', 'source', 'note', 'date', 'status'] as const).map((key) => ({
			key,
			label: t(`volunteer.reports.col.${key}`)
		}))
	);
	const filters = $derived<Filter[]>([
		{
			key: 'status',
			label: t('volunteer.reports.col.status'),
			options: [
				...statuses.map((s) => ({ value: s, label: t(`volunteer.reports.status.${s}`) })),
				{ value: 'all', label: t('volunteer.reports.status.all') }
			]
		},
		{
			key: 'request',
			label: t('volunteer.reports.col.request'),
			options: data.requests.map((r) => ({
				value: r.id,
				label: local(r.title as LocalizedText)
			}))
		}
	]);
</script>

<svelte:head><title>{t('admin.nav.volunteerReports')} — {t('admin.title')}</title></svelte:head>

<h1 class="mb-6 text-2xl font-bold">{t('admin.nav.volunteerReports')}</h1>

<FilterBar {filters} state={data.state} searchLabel="" />

<DataTable rows={data.rows} {columns} caption={t('admin.nav.volunteerReports')} state={data.state}>
	{#snippet cell(row, column)}
		{#if column.key === 'member'}
			<a
				class="font-bold text-navy-700 underline-offset-2 hover:underline"
				href="/admin/volunteer/reports/{row.id}">{row.name}</a
			>
		{:else if column.key === 'request'}{local(row.requestTitle)}
		{:else if column.key === 'source'}
			{row.url ? t('volunteer.reports.openLink') : t('volunteer.reports.hasPhoto')}
		{:else if column.key === 'note'}{row.note ?? '—'}
		{:else if column.key === 'date'}{newsDate(row.date, currentLocale())}
		{:else if column.key === 'status'}{t(`volunteer.reports.status.${row.status}`)}
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={Camera} title={t('volunteer.reports.empty')} />
	{/snippet}
</DataTable>
<div class="mt-4"><Pagination total={data.total} current={data.state.page} /></div>
