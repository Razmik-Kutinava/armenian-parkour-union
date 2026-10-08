<script lang="ts">
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import FilterBar, { type Filter } from '#lib/components/admin/FilterBar.svelte';
	import Pagination from '#lib/components/admin/Pagination.svelte';
	import { eventDates } from '#lib/components/site/event-date.ts';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import { formatPrice } from '#lib/money.ts';
	import { eventStatuses } from '#lib/validation/event-enums.ts';
	import EventStatusBadge from './EventStatusBadge.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 5: cover, title, dates, place, status, registrations / limit, price. */
	let { data }: PageProps = $props();
	const listState = $derived(data.state);
	const columns = $derived<Column[]>([
		{ key: 'cover', label: t('events.col.cover') },
		{ key: 'title', label: t('events.col.title') },
		{ key: 'dates', label: t('events.col.dates'), class: 'whitespace-nowrap' },
		{ key: 'place', label: t('events.col.place') },
		{ key: 'status', label: t('events.col.status') },
		{ key: 'registrations', label: t('events.col.registrations') },
		{ key: 'price', label: t('events.col.price'), class: 'whitespace-nowrap' }
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
		},
		{
			key: 'city',
			label: t('events.filter.city'),
			options: data.cities.map((c) => ({ value: c, label: c }))
		},
		{
			key: 'price',
			label: t('events.filter.price'),
			options: (['free', 'paid'] as const).map((p) => ({ value: p, label: t(`events.price.${p}`) }))
		}
	]);
</script>

<svelte:head><title>{t('admin.nav.events')} — {t('admin.title')}</title></svelte:head>

<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-bold">{t('admin.nav.events')}</h1>
	<a
		href="/admin/events/new"
		class="text-white inline-flex min-h-11 items-center rounded-md bg-navy-700 px-4 font-bold hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 sm:min-h-10"
		>{t('events.create')}</a
	>
</div>

<FilterBar {filters} state={listState} searchLabel={t('events.search')} />

<DataTable rows={data.rows} {columns} caption={t('admin.nav.events')} state={listState}>
	{#snippet cell(row, column)}
		{#if column.key === 'cover'}
			<div class="h-10 w-16 overflow-hidden rounded-sm bg-navy-100">
				{#if row.coverUrl}<img src={row.coverUrl} alt="" class="size-full object-cover" />{/if}
			</div>
		{:else if column.key === 'title'}
			<a
				class="font-bold text-navy-700 underline-offset-2 hover:underline"
				href="/admin/events/{row.id}">{pickLocalized(row.title, currentLocale())}</a
			>
		{:else if column.key === 'dates'}{eventDates(row.startsAt, row.endsAt, currentLocale())}
		{:else if column.key === 'place'}{[row.locationName, row.city].filter(Boolean).join(', ') ||
				'—'}
		{:else if column.key === 'status'}<EventStatusBadge status={row.status} />
		{:else if column.key === 'registrations'}— / {row.capacity ?? t('events.noLimit')}
		{:else if column.key === 'price'}{row.priceAmountMinor === 0
				? t('events.free')
				: formatPrice(row.priceAmountMinor, row.priceCurrency, currentLocale())}
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={CalendarDays} title={t('events.empty')} />
	{/snippet}
</DataTable>

<div class="mt-4"><Pagination total={data.total} current={listState.page} /></div>
