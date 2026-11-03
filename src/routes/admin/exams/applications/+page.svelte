<script lang="ts">
	import ClipboardList from '@lucide/svelte/icons/clipboard-list';
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import FilterBar, { type Filter } from '#lib/components/admin/FilterBar.svelte';
	import Pagination from '#lib/components/admin/Pagination.svelte';
	import { newsDate } from '#lib/components/site/news-date.ts';
	import Button from '#lib/components/ui/Button.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { EXAM_KINDS } from '#lib/validation/exam-enums.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let rejectId = $state<string | null>(null);
	let open = $state(false);

	const columns = $derived<Column[]>([
		{ key: 'member', label: t('exams.col.member') },
		{ key: 'kind', label: t('exams.col.kind') },
		{ key: 'createdAt', label: t('exams.applications.col.date'), sortable: true },
		{ key: 'status', label: t('exams.applications.col.status') },
		{ key: 'actions', label: t('exams.applications.col.actions') }
	]);
	const filters = $derived<Filter[]>([
		{
			key: 'status',
			label: t('exams.applications.col.status'),
			options: (['pending', 'approved', 'rejected'] as const).map((s) => ({
				value: s,
				label: t(`exams.applications.status.${s}`)
			}))
		},
		{
			key: 'kind',
			label: t('exams.col.kind'),
			options: EXAM_KINDS.map((k) => ({ value: k, label: t(`exams.kind.${k}`) }))
		}
	]);
</script>

<svelte:head><title>{t('exams.applications.title')} — {t('admin.title')}</title></svelte:head>

<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-bold">{t('exams.applications.title')}</h1>
	<a href="/admin/exams" class="font-bold text-navy-700 underline-offset-2 hover:underline"
		>{t('exams.applications.back')}</a
	>
</div>

{#if form?.done}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t('exams.applications.done.rejected')}
	</p>
{:else if form?.message}
	<p role="alert" class="mb-4 rounded-md bg-error-bg p-3 text-sm text-error-fg">
		{t(form.message)}
	</p>
{/if}

<FilterBar {filters} state={data.state} searchLabel={t('exams.search')} />

<DataTable rows={data.rows} {columns} caption={t('exams.applications.title')} state={data.state}>
	{#snippet cell(row, column)}
		{#if column.key === 'member'}
			<a
				class="font-bold text-navy-700 underline-offset-2 hover:underline"
				href="/admin/users/{row.userId}">{row.memberName}</a
			>
		{:else if column.key === 'kind'}{t(`exams.kind.${row.kind}`)}
		{:else if column.key === 'createdAt'}{newsDate(row.createdAt, currentLocale())}
		{:else if column.key === 'status'}
			{t(`exams.applications.status.${row.status}`)}
			{#if row.reviewNote}<p class="text-xs text-ink-700">{row.reviewNote}</p>{/if}
		{:else if column.key === 'actions' && row.status === 'pending'}
			<div class="flex flex-wrap items-center gap-2">
				<a
					class="inline-flex min-h-11 items-center rounded-md bg-navy-700 px-3 text-sm font-bold text-surface hover:bg-navy-800 sm:min-h-9"
					href="/admin/exams/new?member={row.userId}&kind={row.kind}"
					>{t('exams.applications.schedule')}</a
				>
				<Button
					type="button"
					variant="secondary"
					onclick={() => {
						rejectId = row.id;
						open = true;
					}}>{t('exams.applications.reject')}</Button
				>
			</div>
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={ClipboardList} title={t('exams.applications.empty')} />
	{/snippet}
</DataTable>

<div class="mt-4"><Pagination total={data.total} current={data.state.page} /></div>

<ConfirmDialog
	bind:open
	title={t('exams.applications.reject')}
	text={t('exams.applications.rejectHint')}
	confirmLabel={t('exams.applications.reject')}
	action="?/reject"
	comment="required"
	danger
>
	{#snippet fields()}
		<input type="hidden" name="id" value={rejectId ?? ''} />
	{/snippet}
</ConfirmDialog>
