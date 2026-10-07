<script lang="ts">
	import ScrollText from '@lucide/svelte/icons/scroll-text';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import FilterBar, { type Filter } from '#lib/components/admin/FilterBar.svelte';
	import Pagination from '#lib/components/admin/Pagination.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const columns = $derived<Column[]>([
		{ key: 'createdAt', label: t('audit.col.date'), sortable: true, class: 'whitespace-nowrap' },
		{ key: 'actor', label: t('audit.col.actor') },
		{ key: 'action', label: t('audit.col.action') },
		{ key: 'entity', label: t('audit.col.entity') },
		{ key: 'ip', label: 'IP' },
		{ key: 'open', label: t('audit.col.details') }
	]);
	const toOptions = (values: string[]) => values.map((value) => ({ value, label: value }));
	const filters = $derived<Filter[]>([
		{ key: 'action', label: t('audit.col.action'), options: toOptions(data.options.actions) },
		{ key: 'entity', label: t('audit.col.entity'), options: toOptions(data.options.entities) },
		{ key: 'from', label: t('audit.filter.from'), type: 'date' },
		{ key: 'to', label: t('audit.filter.to'), type: 'date' }
	]);
	const when = (d: Date) => d.toLocaleString(currentLocale());
</script>

<svelte:head><title>{t('admin.nav.audit')} — {t('admin.title')}</title></svelte:head>

<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-bold">{t('admin.nav.audit')}</h1>
	<a
		href="/admin/audit/export{data.query}"
		class="inline-flex min-h-11 items-center rounded-md border border-navy-700 px-4 font-bold text-navy-700 hover:bg-navy-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 sm:min-h-10"
		download>{t('audit.export')}</a
	>
</div>

<FilterBar {filters} state={data.state} searchLabel={t('audit.search')} />

<DataTable rows={data.rows} {columns} caption={t('admin.nav.audit')} state={data.state}>
	{#snippet cell(row, column)}
		{#if column.key === 'createdAt'}{when(row.createdAt)}
		{:else if column.key === 'actor'}{row.actorName ?? t('users.history.system')}
		{:else if column.key === 'action'}<span class="font-mono text-xs">{row.action}</span>
		{:else if column.key === 'entity'}
			{#if row.entityType === 'user' && row.entityId}
				<a class="text-navy-700 hover:underline" href="/admin/users/{row.entityId}"
					>{row.entityType}</a
				>
			{:else}{row.entityType ?? '—'}{/if}
		{:else if column.key === 'ip'}{row.ip ?? '—'}
		{:else if column.key === 'open'}
			<a class="font-bold text-navy-700 hover:underline" href="/admin/audit/{row.id}"
				>{t('audit.open')}</a
			>
		{/if}
	{/snippet}
	{#snippet empty()}<EmptyState icon={ScrollText} title={t('users.historyEmpty')} />{/snippet}
</DataTable>

<div class="mt-4"><Pagination total={data.total} current={data.state.page} /></div>
