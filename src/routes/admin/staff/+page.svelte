<script lang="ts">
	import IdCard from '@lucide/svelte/icons/id-card';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import FilterBar, { type Filter } from '#lib/components/admin/FilterBar.svelte';
	import Pagination from '#lib/components/admin/Pagination.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { STAFF_FLAGS, STAFF_KINDS } from '#lib/validation/staff-enums.ts';
	import type { PageProps } from './$types';

	/* docs/05 section 9: member, kind, category, license, certificate, public, active;
	 * filters kind, active, public. Profiles come from certificates: nothing to create here. */
	let { data }: PageProps = $props();

	const columns = $derived<Column[]>([
		{ key: 'member', label: t('staff.col.member'), sortable: true },
		{ key: 'kind', label: t('staff.col.kind') },
		{ key: 'category', label: t('staff.col.category') },
		{ key: 'license', label: t('staff.col.license') },
		{ key: 'certificate', label: t('staff.col.certificate') },
		{ key: 'public', label: t('staff.col.public') },
		{ key: 'active', label: t('staff.col.active') }
	]);
	const flags = $derived(STAFF_FLAGS.map((f) => ({ value: f, label: t(`staff.flag.${f}`) })));
	const filters = $derived<Filter[]>([
		{
			key: 'kind',
			label: t('staff.col.kind'),
			options: STAFF_KINDS.map((k) => ({ value: k, label: t(`certificates.admin.kind.${k}`) }))
		},
		{ key: 'active', label: t('staff.col.active'), options: flags },
		{ key: 'public', label: t('staff.col.public'), options: flags }
	]);
	const yesNo = (value: boolean) => t(value ? 'staff.flag.yes' : 'staff.flag.no');
</script>

<svelte:head><title>{t('admin.nav.staff')} — {t('admin.title')}</title></svelte:head>

<h1 class="mb-6 text-2xl font-bold">{t('admin.nav.staff')}</h1>

<FilterBar {filters} state={data.state} searchLabel={t('staff.search')} />

<DataTable rows={data.rows} {columns} caption={t('admin.nav.staff')} state={data.state}>
	{#snippet cell(row, column)}
		{#if column.key === 'member'}
			<a
				class="font-bold text-navy-700 underline-offset-2 hover:underline"
				href="/admin/staff/{row.id}">{row.memberName}</a
			>
		{:else if column.key === 'kind'}{t(`certificates.admin.kind.${row.kind}`)}
		{:else if column.key === 'category'}{row.category ?? '—'}
		{:else if column.key === 'license'}{row.licenseNumber ?? '—'}
		{:else if column.key === 'certificate'}
			{#if row.certificateId}
				<a class="text-navy-700 underline" href="/admin/certificates/{row.certificateId}"
					>{row.certificateNumber}</a
				>
			{:else}—{/if}
		{:else if column.key === 'public'}{yesNo(row.isPublic)}
		{:else if column.key === 'active'}{yesNo(row.isActive)}
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={IdCard} title={t('staff.empty')} />
	{/snippet}
</DataTable>

<div class="mt-4"><Pagination total={data.total} current={data.state.page} /></div>
