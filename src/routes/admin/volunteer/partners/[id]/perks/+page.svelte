<script lang="ts">
	import Gift from '@lucide/svelte/icons/gift';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import StatusBadge from '../../StatusBadge.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 28 "Perks": title, kind and limit, dates, status, order; no deletion. */
	let { data }: PageProps = $props();
	const base = $derived(`/admin/volunteer/partners/${data.partner.id}/perks`);
	const columns = $derived<Column[]>([
		{ key: 'title', label: t('volunteer.perks.col.title') },
		{ key: 'kind', label: t('volunteer.perks.col.kind') },
		{ key: 'dates', label: t('volunteer.perks.col.dates') },
		{ key: 'status', label: t('volunteer.perks.col.status') },
		{ key: 'order', label: t('volunteer.perks.col.order'), class: 'text-right' }
	]);
</script>

<svelte:head>
	<title>{t('volunteer.tab.perks')}: {data.partner.name} — {t('admin.title')}</title>
</svelte:head>

<div class="mb-4 flex justify-end">
	<a
		href="{base}/new"
		class="inline-flex min-h-11 items-center rounded-md bg-navy-700 px-4 font-bold text-surface hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 sm:min-h-10"
		>{t('volunteer.perks.create')}</a
	>
</div>

<DataTable rows={data.perks} {columns} caption={t('volunteer.tab.perks')}>
	{#snippet cell(row, column)}
		{#if column.key === 'title'}
			<a class="font-bold text-navy-700 underline-offset-2 hover:underline" href="{base}/{row.id}"
				>{pickLocalized(row.title, currentLocale())}</a
			>
		{:else if column.key === 'kind'}
			{row.kind === 'single'
				? t('volunteer.perk.singleCount', { count: row.usesLimit ?? 0 })
				: t('volunteer.perk.kind.reusable')}
		{:else if column.key === 'dates'}
			{#if row.validFrom || row.validUntil}
				{row.validFrom ?? '…'} – {row.validUntil ?? '…'}
			{:else}{t('volunteer.perk.noDates')}{/if}
		{:else if column.key === 'status'}<StatusBadge status={row.status} />
		{:else if column.key === 'order'}{row.sortOrder}
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={Gift} title={t('volunteer.perks.empty')} />
	{/snippet}
</DataTable>
