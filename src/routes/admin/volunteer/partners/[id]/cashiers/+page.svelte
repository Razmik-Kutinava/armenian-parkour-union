<script lang="ts">
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import { enhance } from '$app/forms';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import { eventMoment } from '#lib/components/site/event-date.ts';
	import Button from '#lib/components/ui/Button.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import CashierActions from './CashierActions.svelte';
	import InviteLink from './InviteLink.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 28 "Cashiers": who or where, state, last mark; create, new link, disable. */
	let { data, form }: PageProps = $props();
	const columns = $derived<Column[]>([
		{ key: 'label', label: t('volunteer.cashiers.col.label') },
		{ key: 'state', label: t('volunteer.cashiers.col.state') },
		{ key: 'lastUsed', label: t('volunteer.cashiers.col.lastUsed') },
		{ key: 'actions', label: t('volunteer.cashiers.col.actions'), class: 'text-right' }
	]);
	const moment = (date: Date | null) => (date ? eventMoment(date, currentLocale()) : '—');
	const STATE = {
		waiting: 'volunteer.cashiers.state.waiting',
		expired: 'volunteer.cashiers.state.expired',
		bound: 'volunteer.cashiers.state.bound',
		disabled: 'volunteer.cashiers.state.disabled'
	} as const;
	const stateDate = (row: (typeof data.cashiers)[number]) =>
		({
			waiting: row.inviteExpiresAt,
			expired: row.inviteExpiresAt,
			bound: row.boundAt,
			disabled: row.disabledAt
		})[row.state];
</script>

<svelte:head>
	<title>{t('volunteer.tab.cashiers')}: {data.partner.name} — {t('admin.title')}</title>
</svelte:head>

{#if form?.invite}<InviteLink invite={form.invite} />{/if}
{#if form?.error && form.label === undefined}
	<p role="alert" class="mb-4 text-error-fg">{t(form.error)}</p>
{/if}

<p class="mb-4 max-w-2xl text-sm text-ink-700">{t('volunteer.cashiers.intro')}</p>
<form method="POST" action="?/create" use:enhance class="mb-6 flex flex-wrap items-end gap-3">
	<div class="min-w-64 flex-1">
		<Input
			name="label"
			label={t('volunteer.cashiers.label')}
			hint={t('volunteer.cashiers.labelHint')}
			required
			maxlength={80}
			value={form?.label ?? ''}
			error={form?.error && form.label !== undefined ? t(form.error) : undefined}
		/>
	</div>
	<Button type="submit">{t('volunteer.cashiers.create')}</Button>
</form>

<DataTable rows={data.cashiers} {columns} caption={t('volunteer.tab.cashiers')}>
	{#snippet cell(row, column)}
		{#if column.key === 'label'}<span class="font-bold text-ink-900">{row.label}</span>
		{:else if column.key === 'state'}
			{t(STATE[row.state], { date: moment(stateDate(row)) })}
		{:else if column.key === 'lastUsed'}{moment(row.lastUsedAt)}
		{:else if column.key === 'actions' && row.state !== 'disabled'}
			<CashierActions cashier={row} />
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={Smartphone} title={t('volunteer.cashiers.empty')} />
	{/snippet}
</DataTable>
