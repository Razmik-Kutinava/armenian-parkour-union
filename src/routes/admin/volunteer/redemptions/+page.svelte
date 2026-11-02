<script lang="ts">
	import Ticket from '@lucide/svelte/icons/ticket';
	import { page } from '$app/state';
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import FilterBar, { type Filter } from '#lib/components/admin/FilterBar.svelte';
	import Pagination from '#lib/components/admin/Pagination.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import type { PageProps } from './$types';

	/* docs/05 section 28 "Redemptions": journal, summary, reverse with a comment. */
	let { data, form }: PageProps = $props();

	const columns = $derived<Column[]>([
		{ key: 'createdAt', label: t('volunteer.redemptions.col.date'), sortable: true },
		{ key: 'member', label: t('volunteer.redemptions.col.member') },
		{ key: 'partner', label: t('volunteer.redemptions.col.partner') },
		{ key: 'perk', label: t('volunteer.redemptions.col.perk') },
		{ key: 'cashier', label: t('volunteer.redemptions.col.cashier') },
		{ key: 'reversal', label: t('volunteer.redemptions.col.reversal') },
		{ key: 'actions', label: t('volunteer.redemptions.col.actions') }
	]);
	const filters = $derived<Filter[]>([
		{
			key: 'partner',
			label: t('volunteer.redemptions.col.partner'),
			options: data.partners.map((p) => ({ value: p.id, label: p.name }))
		},
		{ key: 'from', label: t('volunteer.redemptions.filter.from'), type: 'date' },
		{ key: 'to', label: t('volunteer.redemptions.filter.to'), type: 'date' }
	]);
	type Row = (typeof data.rows)[number];
	let target = $state<Row | null>(null);
	let reverseOpen = $state(false);
	const openReverse = (row: Row) => {
		target = row;
		reverseOpen = true;
	};
	const reverseAction = $derived(`?/reverse&${page.url.searchParams}`);
	const exportHref = $derived(`/admin/volunteer/redemptions/export?${page.url.searchParams}`);
</script>

<svelte:head><title>{t('admin.nav.volunteerRedemptions')} — {t('admin.title')}</title></svelte:head>

<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-bold">{t('admin.nav.volunteerRedemptions')}</h1>
	<a
		href={exportHref}
		class="inline-flex min-h-11 items-center rounded-md border border-navy-700 px-4 font-bold text-navy-700 hover:bg-navy-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 sm:min-h-10"
		>{t('volunteer.redemptions.export')}</a
	>
</div>

{#if form?.reversed}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t('volunteer.redemptions.reversed')}
	</p>
{:else if form?.message}
	<p role="alert" class="mb-4 rounded-md bg-error-bg p-3 text-sm text-error-fg">
		{t(form.message)}
	</p>
{/if}

{#if data.summary.length > 0}
	<section class="mb-6" aria-labelledby="redemptions-summary">
		<h2 id="redemptions-summary" class="mb-2 text-lg font-bold">
			{t('volunteer.redemptions.summary')}
		</h2>
		<ul class="flex flex-col gap-1 text-sm text-ink-900">
			{#each data.summary as line (line.perkId)}
				<li>
					<span class="font-bold">{line.partnerName}</span>
					— {pickLocalized(line.perkTitle, currentLocale())}:
					{t('volunteer.redemptions.summaryLine', {
						marks: String(line.marks),
						cards: String(line.uniqueCards)
					})}
				</li>
			{/each}
		</ul>
	</section>
{/if}

<FilterBar {filters} state={data.state} searchLabel={t('volunteer.redemptions.search')} />

<DataTable
	rows={data.rows}
	{columns}
	caption={t('admin.nav.volunteerRedemptions')}
	state={data.state}
>
	{#snippet cell(row, column)}
		{#if column.key === 'createdAt'}{row.createdAt.toLocaleString(currentLocale())}
		{:else if column.key === 'member'}
			<a class="text-navy-700 underline" href="/admin/volunteer/cards/{row.cardId}"
				>{row.memberName}{row.cardNumber ? ` (${row.cardNumber})` : ''}</a
			>
		{:else if column.key === 'partner'}{row.partnerName}
		{:else if column.key === 'perk'}{pickLocalized(row.perkTitle, currentLocale())}
		{:else if column.key === 'cashier'}{row.cashierLabel ?? '—'}
		{:else if column.key === 'reversal'}
			{#if row.reversalOfId}
				{t('volunteer.redemptions.isReversal')}{row.comment ? `: ${row.comment}` : ''}
			{:else if row.reversedById}
				{t('volunteer.redemptions.wasReversed')}
			{:else}
				—
			{/if}
		{:else if column.key === 'actions'}
			{#if !row.reversalOfId && !row.reversedById}
				<button type="button" class="text-navy-700 underline" onclick={() => openReverse(row)}
					>{t('volunteer.redemptions.reverse')}</button
				>
			{/if}
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={Ticket} title={t('volunteer.redemptions.empty')} />
	{/snippet}
</DataTable>
<div class="mt-4"><Pagination total={data.total} current={data.state.page} /></div>

{#if target}
	<ConfirmDialog
		bind:open={reverseOpen}
		title={t('volunteer.redemptions.reverse')}
		text={t('volunteer.redemptions.reverseText', {
			member: target.memberName,
			perk: pickLocalized(target.perkTitle, currentLocale())
		})}
		action={reverseAction}
		confirmLabel={t('volunteer.redemptions.reverse')}
		danger
		comment="required"
	>
		{#snippet fields()}
			<input type="hidden" name="redemptionId" value={target?.id ?? ''} />
		{/snippet}
	</ConfirmDialog>
{/if}
