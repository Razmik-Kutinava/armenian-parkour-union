<script lang="ts">
	import UserCheck from '@lucide/svelte/icons/user-check';
	import { enhance } from '$app/forms';
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import FilterBar, { type Filter } from '#lib/components/admin/FilterBar.svelte';
	import Pagination from '#lib/components/admin/Pagination.svelte';
	import { newsDate } from '#lib/components/site/news-date.ts';
	import Button from '#lib/components/ui/Button.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickPortal } from '#lib/i18n/localized.ts';
	import type { PageProps } from './$types';

	/* docs/05 section 27 "Requests": pending by default, oldest on top; a reason for reject and revoke. */
	let { data, form }: PageProps = $props();

	let dialog = $state<{ action: 'reject' | 'revoke'; id: string } | null>(null);
	let open = $state(false);
	const ask = (action: 'reject' | 'revoke', id: string) => {
		dialog = { action, id };
		open = true;
	};

	const statuses = ['pending', 'approved', 'rejected', 'revoked'] as const;
	const columns = $derived<Column[]>(
		(['member', 'course', 'date', 'status', 'age', 'level', 'paidUntil', 'actions'] as const).map(
			(key) => ({ key, label: t(`training.access.col.${key}`) })
		)
	);
	const filters = $derived<Filter[]>([
		{
			key: 'status',
			label: t('training.access.filter.status'),
			options: [
				...statuses.map((s) => ({ value: s, label: t(`training.access.status.${s}`) })),
				{ value: 'all', label: t('training.access.status.all') }
			]
		},
		{
			key: 'course',
			label: t('training.access.filter.course'),
			options: data.courses.map((c) => ({
				value: c.id,
				label: pickPortal(c.title, currentLocale())
			}))
		}
	]);
	const missing = (list: string[]) =>
		list.map((m) => t(`training.missing.${m as 'membership' | 'age' | 'level'}`)).join(', ');
	const date = (d: Date | null) => (d ? newsDate(d, currentLocale()) : t('training.access.none'));
</script>

<svelte:head><title>{t('admin.nav.trainingAccess')} — {t('admin.title')}</title></svelte:head>

<h1 class="mb-6 text-2xl font-bold">{t('admin.nav.trainingAccess')}</h1>

{#if form?.done}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t(`training.access.done.${form.done}`)}
	</p>
{:else if form?.missing}
	<p role="alert" class="mb-4 rounded-md bg-error-bg p-3 text-sm text-error-fg">
		{t('training.access.error.conditions', { missing: missing(form.missing) })}
	</p>
{:else if form?.message}
	<p role="alert" class="mb-4 rounded-md bg-error-bg p-3 text-sm text-error-fg">
		{t(form.message)}
	</p>
{/if}

<FilterBar {filters} state={data.state} searchLabel={t('training.access.search')} />

<DataTable rows={data.rows} {columns} caption={t('admin.nav.trainingAccess')} state={data.state}>
	{#snippet cell(row, column)}
		{#if column.key === 'member'}
			<a
				class="font-bold text-navy-700 underline-offset-2 hover:underline"
				href="/admin/users/{row.userId}">{row.name}</a
			>
		{:else if column.key === 'course'}{pickPortal(row.courseTitle, currentLocale())}
		{:else if column.key === 'date'}{date(row.date)}
		{:else if column.key === 'status'}
			{t(`training.access.status.${row.status}`)}
			{#if row.reviewNote}<p class="text-xs text-ink-700">{row.reviewNote}</p>{/if}
		{:else if column.key === 'age'}{row.age ?? t('training.access.none')}
		{:else if column.key === 'level'}{row.level
				? t(`level.${row.level}`)
				: t('training.access.none')}
		{:else if column.key === 'paidUntil'}{date(row.paidUntil)}
		{:else if column.key === 'actions'}
			<div class="flex flex-wrap gap-2">
				{#if row.status === 'pending'}
					<form method="POST" action="?/approve" use:enhance>
						<input type="hidden" name="accessId" value={row.id} />
						<Button type="submit" size="sm">{t('training.access.approve')}</Button>
					</form>
					<Button size="sm" variant="danger" onclick={() => ask('reject', row.id)}
						>{t('training.access.reject')}</Button
					>
				{:else if row.status === 'approved'}
					<Button size="sm" variant="danger" onclick={() => ask('revoke', row.id)}
						>{t('training.access.revoke')}</Button
					>
				{/if}
			</div>
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={UserCheck} title={t('training.access.empty')} />
	{/snippet}
</DataTable>

<div class="mt-4"><Pagination total={data.total} current={data.state.page} /></div>

{#if dialog}
	<ConfirmDialog
		bind:open
		title={t(`training.access.${dialog.action}Title`)}
		text={t(`training.access.${dialog.action}Text`)}
		action="?/{dialog.action}"
		confirmLabel={t(`training.access.${dialog.action}`)}
		danger
		comment="required"
	>
		{#snippet fields()}<input type="hidden" name="accessId" value={dialog?.id} />{/snippet}
	</ConfirmDialog>
{/if}
