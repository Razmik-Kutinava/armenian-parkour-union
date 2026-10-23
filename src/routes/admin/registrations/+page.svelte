<script lang="ts">
	import Users from '@lucide/svelte/icons/users';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import FilterBar, { type Filter } from '#lib/components/admin/FilterBar.svelte';
	import Pagination from '#lib/components/admin/Pagination.svelte';
	import { eventDates } from '#lib/components/site/event-date.ts';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import { eventStatuses } from '#lib/validation/event-enums.ts';
	import EventStatusBadge from '../events/EventStatusBadge.svelte';
	import type { PageProps } from './$types';

	/* docs/05 sections 2 and 5: pick an event to open its registrations. */
	let { data }: PageProps = $props();
	const columns = $derived<Column[]>([
		{ key: 'title', label: t('registrationsAdmin.col.event') },
		{ key: 'dates', label: t('registrationsAdmin.col.dates'), class: 'whitespace-nowrap' },
		{ key: 'status', label: t('registrationsAdmin.col.status') },
		{ key: 'seats', label: t('registrationsAdmin.col.seats') },
		{ key: 'waitlist', label: t('registrationsAdmin.col.waitlist') }
	]);
	const filters = $derived<Filter[]>([
		{
			key: 'status',
			label: t('events.col.status'),
			options: eventStatuses.map((s) => ({ value: s, label: t(`events.status.${s}`) }))
		},
		{
			key: 'period',
			label: t('events.filter.period'),
			options: (['upcoming', 'past'] as const).map((p) => ({
				value: p,
				label: t(`events.period.${p}`)
			}))
		}
	]);
</script>

<svelte:head><title>{t('admin.nav.registrations')} — {t('admin.title')}</title></svelte:head>

<h1 class="mb-6 text-2xl font-bold">{t('admin.nav.registrations')}</h1>

<FilterBar {filters} state={data.state} searchLabel={t('events.search')} />

<DataTable rows={data.rows} {columns} caption={t('admin.nav.registrations')} state={data.state}>
	{#snippet cell(row, column)}
		{#if column.key === 'title'}
			<a
				class="font-bold text-navy-700 underline-offset-2 hover:underline"
				href="/admin/registrations/{row.id}">{pickLocalized(row.title, currentLocale())}</a
			>
		{:else if column.key === 'dates'}{eventDates(row.startsAt, row.endsAt, currentLocale())}
		{:else if column.key === 'status'}<EventStatusBadge status={row.status} />
		{:else if column.key === 'seats'}{row.seats} / {row.capacity ?? t('events.noLimit')}
		{:else if column.key === 'waitlist'}{row.waitlist}
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={Users} title={t('registrationsAdmin.events.empty')} />
	{/snippet}
</DataTable>

<div class="mt-4"><Pagination total={data.total} current={data.state.page} /></div>
