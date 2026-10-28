<script lang="ts">
	import Clapperboard from '@lucide/svelte/icons/clapperboard';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import FilterBar, { type Filter } from '#lib/components/admin/FilterBar.svelte';
	import Pagination from '#lib/components/admin/Pagination.svelte';
	import { newsDate } from '#lib/components/site/news-date.ts';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickPortal } from '#lib/i18n/localized.ts';
	import type { PageProps } from './$types';

	/* docs/05 section 27 "Practice": pending by default, oldest on top; filters course, task, status. */
	let { data }: PageProps = $props();
	const local = (text: Parameters<typeof pickPortal>[0]) => pickPortal(text, currentLocale());
	const statuses = ['pending', 'approved', 'rejected'] as const;
	const columns = $derived<Column[]>(
		(['member', 'course', 'task', 'link', 'date', 'status'] as const).map((key) => ({
			key,
			label: t(`training.practice.col.${key}`)
		}))
	);
	const filters = $derived<Filter[]>([
		{
			key: 'status',
			label: t('training.practice.filter.status'),
			options: [
				...statuses.map((s) => ({ value: s, label: t(`training.practice.status.${s}`) })),
				{ value: 'all', label: t('training.practice.status.all') }
			]
		},
		{
			key: 'course',
			label: t('training.practice.filter.course'),
			options: data.courses.map((c) => ({ value: c.id, label: local(c.title) }))
		},
		{
			key: 'task',
			label: t('training.practice.filter.task'),
			options: data.tasks.map((task) => ({
				value: task.id,
				label: `${local(task.courseTitle)}: ${local(task.title)}`
			}))
		}
	]);
</script>

<svelte:head><title>{t('admin.nav.trainingPractice')} — {t('admin.title')}</title></svelte:head>

<h1 class="mb-6 text-2xl font-bold">{t('admin.nav.trainingPractice')}</h1>

<FilterBar {filters} state={data.state} searchLabel={t('training.access.search')} />

<DataTable rows={data.rows} {columns} caption={t('admin.nav.trainingPractice')} state={data.state}>
	{#snippet cell(row, column)}
		{#if column.key === 'member'}
			<a
				class="font-bold text-navy-700 underline-offset-2 hover:underline"
				href="/admin/training/practice/{row.id}">{row.name}</a
			>
		{:else if column.key === 'course'}{local(row.courseTitle)}
		{:else if column.key === 'task'}{local(row.taskTitle)}
		{:else if column.key === 'link'}{t(`training.practice.platform.${row.platform}`)}
		{:else if column.key === 'date'}{newsDate(row.date, currentLocale())}
		{:else if column.key === 'status'}{t(`training.practice.status.${row.status}`)}
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={Clapperboard} title={t('training.practice.empty')} />
	{/snippet}
</DataTable>

<div class="mt-4"><Pagination total={data.total} current={data.state.page} /></div>
