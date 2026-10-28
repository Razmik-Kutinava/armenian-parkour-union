<script lang="ts">
	import GraduationCap from '@lucide/svelte/icons/graduation-cap';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickPortal } from '#lib/i18n/localized.ts';
	import CourseStatusBadge from './CourseStatusBadge.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 27: title, exam kind, status, lessons, questions, tasks, pending requests. */
	let { data }: PageProps = $props();
	const columns = $derived<Column[]>([
		{ key: 'title', label: t('training.courses.col.title') },
		{ key: 'kind', label: t('training.courses.col.kind') },
		{ key: 'status', label: t('training.courses.col.status') },
		{ key: 'lessons', label: t('training.courses.col.lessons'), class: 'text-right' },
		{ key: 'questions', label: t('training.courses.col.questions'), class: 'text-right' },
		{ key: 'tasks', label: t('training.courses.col.tasks'), class: 'text-right' },
		{ key: 'pending', label: t('training.courses.col.pending'), class: 'text-right' }
	]);
	const href = (id: string) =>
		data.canManage ? `/admin/training/${id}` : `/admin/training/${id}/lessons`;
</script>

<svelte:head><title>{t('admin.nav.training')} — {t('admin.title')}</title></svelte:head>

<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-bold">{t('admin.nav.training')}</h1>
	{#if data.canManage}
		<a
			href="/admin/training/new"
			class="inline-flex min-h-11 items-center rounded-md bg-navy-700 px-4 font-bold text-surface hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 sm:min-h-10"
			>{t('training.courses.create')}</a
		>
	{/if}
</div>
{#if !data.canManage}
	<p class="mb-4 text-sm text-ink-700">{t('training.courses.readOnly')}</p>
{/if}

<DataTable rows={data.rows} {columns} caption={t('admin.nav.training')}>
	{#snippet cell(row, column)}
		{#if column.key === 'title'}
			<a class="font-bold text-navy-700 underline-offset-2 hover:underline" href={href(row.id)}
				>{pickPortal(row.title, currentLocale())}</a
			>
		{:else if column.key === 'kind'}{t(`exams.kind.${row.examKind}`)}
		{:else if column.key === 'status'}<CourseStatusBadge status={row.status} />
		{:else if column.key === 'lessons'}{row.lessons}
		{:else if column.key === 'questions'}{row.questions}
		{:else if column.key === 'tasks'}{row.tasks}
		{:else if column.key === 'pending'}
			{#if data.canManage && row.pending > 0}
				<a
					class="font-bold text-navy-700 underline-offset-2 hover:underline"
					href="/admin/training/access?course={row.id}">{row.pending}</a
				>
			{:else}{row.pending}{/if}
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={GraduationCap} title={t('training.courses.empty')} />
	{/snippet}
</DataTable>
