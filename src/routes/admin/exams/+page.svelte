<script lang="ts">
	import ClipboardCheck from '@lucide/svelte/icons/clipboard-check';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import FilterBar, { type Filter } from '#lib/components/admin/FilterBar.svelte';
	import Pagination from '#lib/components/admin/Pagination.svelte';
	import { eventMoment } from '#lib/components/site/event-date.ts';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { EXAM_KINDS, EXAM_RESULTS } from '#lib/validation/exam-enums.ts';
	import ExamResult from './ExamResult.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 7: member, kind, date, examiner, result, score; filters kind, result, period. */
	let { data }: PageProps = $props();

	const columns = $derived<Column[]>([
		{ key: 'member', label: t('exams.col.member') },
		{ key: 'kind', label: t('exams.col.kind') },
		{ key: 'scheduledAt', label: t('exams.col.date'), sortable: true },
		{ key: 'examiner', label: t('exams.col.examiner') },
		{ key: 'result', label: t('exams.col.result') },
		{ key: 'score', label: t('exams.col.score'), class: 'text-right' }
	]);
	const filters = $derived<Filter[]>([
		{
			key: 'kind',
			label: t('exams.col.kind'),
			options: EXAM_KINDS.map((k) => ({ value: k, label: t(`exams.kind.${k}`) }))
		},
		{
			key: 'result',
			label: t('exams.col.result'),
			options: EXAM_RESULTS.map((r) => ({ value: r, label: t(`exams.result.${r}`) }))
		},
		{ key: 'from', label: t('exams.filter.from'), type: 'date' },
		{ key: 'to', label: t('exams.filter.to'), type: 'date' }
	]);
</script>

<svelte:head><title>{t('admin.nav.exams')} — {t('admin.title')}</title></svelte:head>

<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-bold">{t('admin.nav.exams')}</h1>
	<a
		href="/admin/exams/new"
		class="text-white inline-flex min-h-11 items-center rounded-md bg-navy-700 px-4 font-bold hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 sm:min-h-10"
		>{t('exams.new')}</a
	>
</div>

<FilterBar {filters} state={data.state} searchLabel={t('exams.search')} />

<DataTable rows={data.rows} {columns} caption={t('admin.nav.exams')} state={data.state}>
	{#snippet cell(row, column)}
		{#if column.key === 'member'}
			<a
				class="font-bold text-navy-700 underline-offset-2 hover:underline"
				href="/admin/exams/{row.id}">{row.memberName}</a
			>
		{:else if column.key === 'kind'}{t(`exams.kind.${row.kind}`)}
		{:else if column.key === 'scheduledAt'}
			{row.scheduledAt ? eventMoment(row.scheduledAt, currentLocale()) : '—'}
		{:else if column.key === 'examiner'}{row.examinerName ?? '—'}
		{:else if column.key === 'result'}<ExamResult result={row.result} />
		{:else if column.key === 'score'}{row.score ?? '—'}
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={ClipboardCheck} title={t('exams.empty')} />
	{/snippet}
</DataTable>

<div class="mt-4"><Pagination total={data.total} current={data.state.page} /></div>
