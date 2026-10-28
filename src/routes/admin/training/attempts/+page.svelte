<script lang="ts">
	import ListTodo from '@lucide/svelte/icons/list-todo';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import FilterBar, { type Filter } from '#lib/components/admin/FilterBar.svelte';
	import Pagination from '#lib/components/admin/Pagination.svelte';
	import { newsDate } from '#lib/components/site/news-date.ts';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickPortal } from '#lib/i18n/localized.ts';
	import type { PageProps } from './$types';

	/* docs/05 section 27 "Attempts": newest first; filters course, result, period; name search. */
	let { data }: PageProps = $props();
	const local = (text: Parameters<typeof pickPortal>[0]) => pickPortal(text, currentLocale());
	const results = ['passed', 'failed', 'running'] as const;
	const columns = $derived<Column[]>(
		(['member', 'course', 'started', 'score', 'result', 'extra'] as const).map((key) => ({
			key,
			label: t(`training.attempts.col.${key}`)
		}))
	);
	const filters = $derived<Filter[]>([
		{
			key: 'course',
			label: t('training.attempts.filter.course'),
			options: data.courses.map((c) => ({ value: c.id, label: local(c.title) }))
		},
		{
			key: 'result',
			label: t('training.attempts.filter.result'),
			options: results.map((r) => ({ value: r, label: t(`training.attempts.result.${r}`) }))
		},
		{ key: 'from', label: t('training.attempts.filter.from'), type: 'date' },
		{ key: 'to', label: t('training.attempts.filter.to'), type: 'date' }
	]);
</script>

<svelte:head><title>{t('admin.nav.trainingAttempts')} — {t('admin.title')}</title></svelte:head>

<h1 class="mb-6 text-2xl font-bold">{t('admin.nav.trainingAttempts')}</h1>

<FilterBar {filters} state={data.state} searchLabel={t('training.access.search')} />

<DataTable rows={data.rows} {columns} caption={t('admin.nav.trainingAttempts')} state={data.state}>
	{#snippet cell(row, column)}
		{#if column.key === 'member'}
			<a
				class="font-bold text-navy-700 underline-offset-2 hover:underline"
				href="/admin/training/attempts/{row.id}">{row.name}</a
			>
		{:else if column.key === 'course'}{local(row.courseTitle)}
		{:else if column.key === 'started'}{newsDate(row.startedAt, currentLocale())}
		{:else if column.key === 'score'}{row.correctCount ?? '—'} / {row.total}
		{:else if column.key === 'result'}{t(`training.attempts.result.${row.result}`)}
		{:else if column.key === 'extra'}{row.isExtra ? t('training.attempts.extra') : ''}
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={ListTodo} title={t('training.attempts.empty')} />
	{/snippet}
</DataTable>

<div class="mt-4"><Pagination total={data.total} current={data.state.page} /></div>
