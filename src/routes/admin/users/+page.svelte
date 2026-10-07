<script lang="ts">
	import Users from '@lucide/svelte/icons/users';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import FilterBar from '#lib/components/admin/FilterBar.svelte';
	import Pagination from '#lib/components/admin/Pagination.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const listState = $derived(data.state);
	const columns = $derived<Column[]>([
		{ key: 'name', label: t('users.col.name'), sortable: true },
		...(data.showEmail ? [{ key: 'email', label: t('auth.email') }] : []),
		{ key: 'level', label: t('users.col.level') },
		{ key: 'role', label: t('users.col.role') },
		{ key: 'points', label: t('users.col.points'), sortable: true, class: 'text-right' },
		{ key: 'status', label: t('users.col.status') },
		{ key: 'createdAt', label: t('users.col.created'), sortable: true, class: 'whitespace-nowrap' }
	]);
	const opts = <T extends string>(values: readonly T[], label: (v: T) => string) =>
		values.map((value) => ({ value, label: label(value) }));
	const filters = $derived([
		{
			key: 'level',
			label: t('users.col.level'),
			options: opts(['novice', 'advanced', 'pro'], (v) => t(`level.${v}`))
		},
		{
			key: 'role',
			label: t('users.col.role'),
			options: opts(['member', 'editor', 'moderator', 'admin'], (v) => t(`role.${v}`))
		},
		{
			key: 'status',
			label: t('users.col.status'),
			options: opts(['active', 'blocked'], (v) => t(`users.status.${v}`))
		},
		{
			key: 'age',
			label: t('users.filter.age'),
			options: opts(['minor', 'adult'], (v) => t(`users.age.${v}`))
		},
		{ key: 'city', label: t('users.filter.city'), options: opts(data.cities, (v) => v) }
	]);
	const date = (d: Date) => d.toLocaleDateString(currentLocale());
</script>

<svelte:head><title>{t('admin.nav.users')} — {t('admin.title')}</title></svelte:head>

<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-bold">{t('admin.nav.users')}</h1>
	{#if data.canCreate}
		<a
			href="/admin/users/new"
			class="text-white inline-flex min-h-11 items-center rounded-md bg-navy-700 px-4 font-bold hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 sm:min-h-10"
			>{t('users.create')}</a
		>
	{/if}
</div>

<FilterBar
	{filters}
	state={listState}
	searchLabel={t(data.showEmail ? 'users.searchFull' : 'users.searchName')}
/>

<DataTable rows={data.rows} {columns} caption={t('admin.nav.users')} state={listState}>
	{#snippet cell(row, column)}
		{#if column.key === 'name'}
			<a
				class="font-bold text-navy-700 underline-offset-2 hover:underline"
				href="/admin/users/{row.id}">{row.name}</a
			>
		{:else if column.key === 'email'}{row.email}
		{:else if column.key === 'level'}{row.level ? t(`level.${row.level}`) : '—'}
		{:else if column.key === 'role'}{t(`role.${row.role}`)}
		{:else if column.key === 'points'}{row.pointsBalance}
		{:else if column.key === 'status'}
			<Badge tone={row.status === 'active' ? 'success' : 'error'}
				>{t(`users.status.${row.status}`)}</Badge
			>
		{:else if column.key === 'createdAt'}{date(row.createdAt)}
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={Users} title={t('users.empty')} />
	{/snippet}
</DataTable>

<div class="mt-4"><Pagination total={data.total} current={listState.page} /></div>
