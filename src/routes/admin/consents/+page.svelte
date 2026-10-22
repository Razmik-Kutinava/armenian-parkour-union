<script lang="ts">
	import FileCheck from '@lucide/svelte/icons/file-check';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import FilterBar, { type Filter } from '#lib/components/admin/FilterBar.svelte';
	import Pagination from '#lib/components/admin/Pagination.svelte';
	import { newsDate } from '#lib/components/site/news-date.ts';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { consentKinds } from '#lib/validation/consents.ts';
	import ConsentStatus from './ConsentStatus.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 10: list with filters in the URL. */
	let { data }: PageProps = $props();

	const statuses = ['pending', 'approved', 'rejected', 'expired'] as const;
	const columns = $derived<Column[]>([
		{ key: 'member', label: t('consents.col.member') },
		{ key: 'kind', label: t('consents.col.kind') },
		{ key: 'status', label: t('consents.col.status') },
		{ key: 'signedAt', label: t('consents.col.signedAt'), class: 'whitespace-nowrap' },
		{ key: 'validUntil', label: t('consents.col.validUntil'), sortable: true },
		{ key: 'createdAt', label: t('consents.col.createdAt'), sortable: true }
	]);
	const filters = $derived<Filter[]>([
		{
			key: 'kind',
			label: t('consents.col.kind'),
			options: consentKinds.map((k) => ({ value: k, label: t(`consents.kind.${k}`) }))
		},
		{
			key: 'status',
			label: t('consents.col.status'),
			options: statuses.map((s) => ({ value: s, label: t(`consents.status.${s}`) }))
		},
		{
			key: 'expiring',
			label: t('consents.filter.expiring'),
			options: [{ value: '1', label: t('consents.filter.expiringSoon') }]
		}
	]);
	const day = (d: Date | null) => (d ? newsDate(d, currentLocale()) : '—');
</script>

<svelte:head><title>{t('admin.nav.consents')} — {t('admin.title')}</title></svelte:head>

<h1 class="mb-6 text-2xl font-bold">{t('admin.nav.consents')}</h1>

<FilterBar {filters} state={data.state} searchLabel={t('consents.search')} />

<DataTable rows={data.rows} {columns} caption={t('admin.nav.consents')} state={data.state}>
	{#snippet cell(row, column)}
		{#if column.key === 'member'}
			<a
				class="font-bold text-navy-700 underline-offset-2 hover:underline"
				href="/admin/consents/{row.id}">{row.memberName}</a
			>
		{:else if column.key === 'kind'}{t(`consents.kind.${row.kind}`)}
		{:else if column.key === 'status'}<ConsentStatus status={row.status} />
		{:else if column.key === 'signedAt'}{day(row.signedAt)}
		{:else if column.key === 'validUntil'}{day(row.validUntil)}
		{:else if column.key === 'createdAt'}{day(row.createdAt)}
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={FileCheck} title={t('consents.empty')} />
	{/snippet}
</DataTable>

<div class="mt-4"><Pagination total={data.total} current={data.state.page} /></div>
