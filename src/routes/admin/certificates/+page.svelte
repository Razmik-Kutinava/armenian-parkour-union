<script lang="ts">
	import Award from '@lucide/svelte/icons/award';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import FilterBar, { type Filter } from '#lib/components/admin/FilterBar.svelte';
	import Pagination from '#lib/components/admin/Pagination.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import {
		CERTIFICATE_STATES,
		CERTIFICATE_TYPES,
		EXPIRING_DAYS
	} from '#lib/validation/certificate-enums.ts';
	import CertificateState from './CertificateState.svelte';
	import { certificateDay, levelOrCategory } from './format';
	import type { PageProps } from './$types';

	/* docs/05 section 8: number, member, type, level or category, issued, valid until, status;
	 * filters type, status, expiring within 60 days. */
	let { data }: PageProps = $props();

	const columns = $derived<Column[]>([
		{ key: 'number', label: t('certificates.col.number') },
		{ key: 'member', label: t('certificates.col.member') },
		{ key: 'kind', label: t('certificates.col.kind') },
		{ key: 'levelOrCategory', label: t('certificates.col.levelOrCategory') },
		{ key: 'issuedAt', label: t('certificates.col.issuedAt'), sortable: true },
		{ key: 'expiresAt', label: t('certificates.col.expiresAt'), sortable: true },
		{ key: 'state', label: t('certificates.col.state') }
	]);
	const filters = $derived<Filter[]>([
		{
			key: 'kind',
			label: t('certificates.col.kind'),
			options: CERTIFICATE_TYPES.map((k) => ({ value: k, label: t(`certificates.kind.${k}`) }))
		},
		{
			key: 'state',
			label: t('certificates.col.state'),
			options: CERTIFICATE_STATES.map((s) => ({
				value: s,
				label: t(`certificates.verify.state.${s}`)
			}))
		},
		{
			key: 'expiring',
			label: t('certificates.filter.expiring'),
			options: [{ value: String(EXPIRING_DAYS), label: t('certificates.filter.expiring60') }]
		}
	]);
</script>

<svelte:head><title>{t('admin.nav.certificates')} — {t('admin.title')}</title></svelte:head>

<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-bold">{t('admin.nav.certificates')}</h1>
	{#if data.canIssue}
		<a
			href="/admin/certificates/new"
			class="inline-flex min-h-11 items-center rounded-md bg-navy-700 px-4 font-bold text-surface hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 sm:min-h-10"
			>{t('certificates.new')}</a
		>
	{/if}
</div>

<FilterBar {filters} state={data.state} searchLabel={t('certificates.search')} />

<DataTable rows={data.rows} {columns} caption={t('admin.nav.certificates')} state={data.state}>
	{#snippet cell(row, column)}
		{#if column.key === 'number'}
			<a
				class="font-bold text-navy-700 underline-offset-2 hover:underline"
				href="/admin/certificates/{row.id}">{row.number}</a
			>
		{:else if column.key === 'member'}{row.memberName}
		{:else if column.key === 'kind'}{t(`certificates.admin.kind.${row.kind}`)}
		{:else if column.key === 'levelOrCategory'}{levelOrCategory(row)}
		{:else if column.key === 'issuedAt'}{certificateDay(row.issuedAt)}
		{:else if column.key === 'expiresAt'}{certificateDay(row.expiresAt)}
		{:else if column.key === 'state'}<CertificateState state={row.state} />
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={Award} title={t('certificates.empty')} />
	{/snippet}
</DataTable>

<div class="mt-4"><Pagination total={data.total} current={data.state.page} /></div>
