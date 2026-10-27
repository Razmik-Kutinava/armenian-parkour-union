<script lang="ts">
	import BookOpen from '@lucide/svelte/icons/book-open';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import CourseStatusBadge from '../../CourseStatusBadge.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 27 "Lessons": by topic order, then the lesson's; lessons without a topic last. */
	let { data }: PageProps = $props();
	const base = $derived(`/admin/training/${data.course.id}/lessons`);
	const columns = $derived<Column[]>([
		{ key: 'title', label: t('training.lessons.col.title') },
		{ key: 'topic', label: t('training.lessons.col.topic') },
		{ key: 'order', label: t('training.lessons.col.order'), class: 'text-right' },
		{ key: 'status', label: t('training.lessons.col.status') },
		{ key: 'file', label: t('training.lessons.col.file') }
	]);
	const local = (text: Parameters<typeof pickLocalized>[0]) => pickLocalized(text, currentLocale());
</script>

<svelte:head>
	<title>{t('training.tab.lessons')}: {local(data.course.title)} — {t('admin.title')}</title>
</svelte:head>

<div class="mb-4 flex justify-end">
	<a
		href="{base}/new"
		class="inline-flex min-h-11 items-center rounded-md bg-navy-700 px-4 font-bold text-surface hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 sm:min-h-10"
		>{t('training.lessons.create')}</a
	>
</div>

<DataTable rows={data.lessons} {columns} caption={t('training.tab.lessons')}>
	{#snippet cell(row, column)}
		{#if column.key === 'title'}
			<a class="font-bold text-navy-700 underline-offset-2 hover:underline" href="{base}/{row.id}"
				>{local(row.title)}</a
			>
		{:else if column.key === 'topic'}
			{#if !row.topicTitle}{t('training.lessons.noTopic')}
			{:else if row.topicHidden}{t('training.lessons.hiddenTopic', {
					topic: local(row.topicTitle)
				})}
			{:else}{local(row.topicTitle)}{/if}
		{:else if column.key === 'order'}{row.sortOrder}
		{:else if column.key === 'status'}<CourseStatusBadge status={row.status} />
		{:else if column.key === 'file'}{row.hasFile ? 'PDF' : '—'}
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={BookOpen} title={t('training.lessons.empty')} />
	{/snippet}
</DataTable>
