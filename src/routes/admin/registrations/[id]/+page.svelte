<script lang="ts">
	import Users from '@lucide/svelte/icons/users';
	import { page } from '$app/state';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import FilterBar, { type Filter } from '#lib/components/admin/FilterBar.svelte';
	import { listHref } from '#lib/components/admin/list-state.ts';
	import Pagination from '#lib/components/admin/Pagination.svelte';
	import { eventDates } from '#lib/components/site/event-date.ts';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import EventStatusBadge from '../../events/EventStatusBadge.svelte';
	import AddParticipant from './AddParticipant.svelte';
	import RowActions from './RowActions.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 5, tab "Registrations": columns, filters, actions, CSV with the same filters. */
	let { data, form }: PageProps = $props();
	const event = $derived(data.event);
	const statuses = [
		'registered',
		'pending_payment',
		'waitlist',
		'attended',
		'no_show',
		'cancelled'
	] as const;
	const columns = $derived<Column[]>([
		{ key: 'member', label: t('registrationsAdmin.col.member') },
		{ key: 'age', label: t('registrationsAdmin.col.age') },
		{ key: 'category', label: t('registrationsAdmin.col.category') },
		{ key: 'status', label: t('registrationsAdmin.col.status') },
		{ key: 'paid', label: t('registrationsAdmin.col.paid') },
		{
			key: 'registeredAt',
			label: t('registrationsAdmin.col.registeredAt'),
			sortable: true,
			class: 'whitespace-nowrap'
		},
		{ key: 'attended', label: t('registrationsAdmin.col.attended') },
		{ key: 'place', label: t('registrationsAdmin.col.place') },
		{ key: 'score', label: t('registrationsAdmin.col.score') },
		...(data.canManage ? [{ key: 'actions', label: t('registrationsAdmin.col.actions') }] : [])
	]);
	const filters = $derived<Filter[]>([
		{
			key: 'status',
			label: t('registrationsAdmin.col.status'),
			options: statuses.map((s) => ({ value: s, label: t(`registrationsAdmin.status.${s}`) }))
		},
		...(data.categories.length > 0
			? [
					{
						key: 'category',
						label: t('registrationsAdmin.col.category'),
						options: data.categories.map((c) => ({
							value: c.id,
							label: pickLocalized(c.name, currentLocale())
						}))
					}
				]
			: []),
		...(event.paid
			? [
					{
						key: 'paid',
						label: t('registrationsAdmin.col.paid'),
						options: [
							{ value: '1', label: t('registrationsAdmin.paid.yes') },
							{ value: '0', label: t('registrationsAdmin.paid.no') }
						]
					}
				]
			: [])
	]);
	const moment = (d: Date) =>
		d.toLocaleString(currentLocale(), {
			dateStyle: 'medium',
			timeStyle: 'short',
			timeZone: 'Asia/Yerevan'
		});
	const exportHref = $derived(
		listHref(`/admin/registrations/${event.id}/export`, page.url.searchParams, { page: null })
	);
</script>

<svelte:head>
	<title>{pickLocalized(event.title, currentLocale())} — {t('admin.nav.registrations')}</title>
</svelte:head>

<a
	href="/admin/registrations"
	class="mb-2 inline-block text-sm text-navy-700 underline-offset-2 hover:underline"
	>{t('registrationsAdmin.back')}</a
>
<div class="mb-2 flex flex-wrap items-center gap-3">
	<h1 class="text-2xl font-bold">{pickLocalized(event.title, currentLocale())}</h1>
	<EventStatusBadge status={event.status} />
</div>
<p class="mb-4 text-sm text-ink-700">
	{eventDates(event.startsAt, event.endsAt, currentLocale())} ·
	{t('registrationsAdmin.summary', {
		seats: data.counts.seats,
		capacity: event.capacity ?? t('events.noLimit'),
		waitlist: data.counts.waitlist
	})}
</p>

{#if form && 'done' in form && form.done}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t(form.done)}
	</p>
{:else if form && 'message' in form && form.message}
	<p role="alert" class="mb-4 rounded-md bg-error-bg p-3 text-sm text-error-fg">
		{t(form.message)}
	</p>
{/if}

<div class="mb-4 flex flex-wrap justify-end gap-4 text-sm font-bold">
	<a class="text-navy-700 underline" href="/admin/registrations/{event.id}/day"
		>{t('registrationsAdmin.dayLink')}</a
	>
	<a class="text-navy-700 underline" href="/admin/registrations/{event.id}/results"
		>{t('registrationsAdmin.resultsLink')}</a
	>
	<a class="text-navy-700 underline" href={exportHref}>{t('registrationsAdmin.export')}</a>
</div>

<FilterBar {filters} state={data.state} searchLabel={t('registrationsAdmin.search')} />

<DataTable rows={data.rows} {columns} caption={t('admin.nav.registrations')} state={data.state}>
	{#snippet cell(row, column)}
		{#if column.key === 'member'}
			<span class="font-bold">{row.name}</span>
			{#if row.email}<span class="block text-xs text-ink-500">{row.email}</span>{/if}
		{:else if column.key === 'age'}{row.age ?? '—'}
		{:else if column.key === 'category'}{row.categoryName
				? pickLocalized(row.categoryName, currentLocale())
				: '—'}
		{:else if column.key === 'status'}
			{t(`registrationsAdmin.status.${row.status}`)}
			{#if row.holdUntil}<span class="block text-xs text-ink-500"
					>{t('registrationsAdmin.heldUntil', { time: moment(row.holdUntil) })}</span
				>{/if}
		{:else if column.key === 'paid'}
			{#if row.paid === null}{t('registrationsAdmin.free')}
			{:else}{t(row.paid ? 'registrationsAdmin.paid.yes' : 'registrationsAdmin.paid.no')}{/if}
			{#if data.canPayments && row.paymentId}<a
					class="block text-xs text-navy-700 underline"
					href="/admin/payments/{row.paymentId}">{t('registrationsAdmin.openPayment')}</a
				>{/if}
		{:else if column.key === 'registeredAt'}{moment(row.registeredAt)}
		{:else if column.key === 'attended'}{row.attendedAt ? moment(row.attendedAt) : '—'}
		{:else if column.key === 'place'}{row.place ?? '—'}
		{:else if column.key === 'score'}{row.score ?? '—'}
		{:else if column.key === 'actions'}<RowActions id={row.id} status={row.status} />
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={Users} title={t('registrationsAdmin.empty')} />
	{/snippet}
</DataTable>

<div class="mt-4"><Pagination total={data.total} current={data.state.page} /></div>

{#if data.canManage && event.status === 'published'}
	<AddParticipant categories={data.categories} />
{/if}
