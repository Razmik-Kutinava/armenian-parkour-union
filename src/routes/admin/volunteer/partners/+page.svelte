<script lang="ts">
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import Handshake from '@lucide/svelte/icons/handshake';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import StatusBadge from './StatusBadge.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 28 "Partners": logo, name, status, published perks, active cashier accesses,
	 * uses in 30 days; the order of the check page, ↑ / ↓. */
	let { data }: PageProps = $props();
	const columns = $derived<Column[]>([
		{ key: 'logo', label: t('volunteer.partners.col.logo') },
		{ key: 'name', label: t('volunteer.partners.col.name') },
		{ key: 'status', label: t('volunteer.partners.col.status') },
		{ key: 'perks', label: t('volunteer.partners.col.perks'), class: 'text-right' },
		{ key: 'cashiers', label: t('volunteer.partners.col.cashiers'), class: 'text-right' },
		{ key: 'uses', label: t('volunteer.partners.col.uses'), class: 'text-right' },
		{ key: 'order', label: t('volunteer.partners.col.order') }
	]);
	const last = $derived(data.partners.length - 1);
</script>

{#snippet move(id: string, direction: 'up' | 'down')}
	<form method="POST" action="?/move">
		<input type="hidden" name="partnerId" value={id} />
		<input type="hidden" name="direction" value={direction} />
		<Button
			type="submit"
			variant="ghost"
			size="sm"
			aria-label={t(direction === 'up' ? 'volunteer.partners.up' : 'volunteer.partners.down')}
		>
			{#if direction === 'up'}<ArrowUp class="size-4" aria-hidden="true" />
			{:else}<ArrowDown class="size-4" aria-hidden="true" />{/if}
		</Button>
	</form>
{/snippet}

<svelte:head><title>{t('admin.nav.volunteerPartners')} — {t('admin.title')}</title></svelte:head>

<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-bold">{t('admin.nav.volunteerPartners')}</h1>
	<a
		href="/admin/volunteer/partners/new"
		class="inline-flex min-h-11 items-center rounded-md bg-navy-700 px-4 font-bold text-surface hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 sm:min-h-10"
		>{t('volunteer.partners.create')}</a
	>
</div>

<DataTable rows={data.partners} {columns} caption={t('admin.nav.volunteerPartners')}>
	{#snippet cell(row, column)}
		{#if column.key === 'logo'}
			{#if row.logoUrl}
				<img src={row.logoUrl} alt="" class="size-10 rounded-sm object-contain" />
			{:else}—{/if}
		{:else if column.key === 'name'}
			<a
				class="font-bold text-navy-700 underline-offset-2 hover:underline"
				href="/admin/volunteer/partners/{row.id}">{row.name}</a
			>
		{:else if column.key === 'status'}<StatusBadge status={row.status} />
		{:else if column.key === 'perks'}{row.perksPublished}
		{:else if column.key === 'cashiers'}{row.cashiersActive}
		{:else if column.key === 'uses'}{row.uses30Days}
		{:else if column.key === 'order'}
			{@const index = data.partners.indexOf(row)}
			<div class="flex gap-1">
				{#if index > 0}{@render move(row.id, 'up')}{/if}
				{#if index < last}{@render move(row.id, 'down')}{/if}
			</div>
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={Handshake} title={t('volunteer.partners.empty')} />
	{/snippet}
</DataTable>
