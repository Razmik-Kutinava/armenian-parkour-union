<script lang="ts">
	import HandHeart from '@lucide/svelte/icons/hand-heart';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import { formatPrice } from '#lib/money.ts';
	import type { PageProps } from './$types';

	/* docs/05 section 17: purposes are hidden, not deleted; the sum shows what each one gathered. */
	let { data }: PageProps = $props();
	const columns = $derived<Column[]>([
		{ key: 'title', label: t('purposes.col.title') },
		{ key: 'active', label: t('purposes.col.active') },
		{ key: 'order', label: t('purposes.col.order'), class: 'text-right' },
		{ key: 'collected', label: t('purposes.col.collected'), class: 'text-right' }
	]);
</script>

<svelte:head><title>{t('admin.nav.donations')} вЂ” {t('admin.title')}</title></svelte:head>

<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-bold">{t('admin.nav.donations')}</h1>
	<a
		href="/admin/donation-purposes/new"
		class="text-white inline-flex min-h-11 items-center rounded-md bg-navy-700 px-4 font-bold hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 sm:min-h-10"
		>{t('purposes.create')}</a
	>
</div>

<DataTable rows={data.purposes} {columns} caption={t('admin.nav.donations')}>
	{#snippet cell(row, column)}
		{#if column.key === 'title'}
			<a
				class="font-bold text-navy-700 underline-offset-2 hover:underline"
				href="/admin/donation-purposes/{row.id}">{pickLocalized(row.title, currentLocale())}</a
			>
		{:else if column.key === 'active'}
			{#if row.isActive}{t('purposes.yes')}{:else}<Badge>{t('purposes.hidden')}</Badge>{/if}
		{:else if column.key === 'order'}{row.sortOrder}
		{:else if column.key === 'collected'}
			{row.collected
				.map((c) => formatPrice(c.amountMinor, c.currency, currentLocale()))
				.join(', ') || 'вЂ”'}
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={HandHeart} title={t('purposes.empty')} />
	{/snippet}
</DataTable>
