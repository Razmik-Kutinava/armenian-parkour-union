<script lang="ts">
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import FilterBar, { type Filter } from '#lib/components/admin/FilterBar.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickPortal, type PortalText } from '#lib/i18n/localized.ts';
	import type { PageProps } from './$types';

	/* docs/05 section 27 "Question bank": №, topic, text, correct option, source, hidden;
	 * under the filter — questions in the topic against the quiz. */
	let { data }: PageProps = $props();
	const base = $derived(`/admin/training/${data.course.id}/questions`);
	const local = (text: PortalText) => pickPortal(text, currentLocale());
	const start = (text: PortalText) => {
		const s = local(text);
		return s.length > 120 ? `${s.slice(0, 120)}…` : s;
	};
	const columns = $derived<Column[]>([
		{ key: 'number', label: t('training.questions.col.number'), class: 'text-right' },
		{ key: 'topic', label: t('training.questions.col.topic') },
		{ key: 'text', label: t('training.questions.col.text') },
		{ key: 'correct', label: t('training.questions.col.correct') },
		{ key: 'source', label: t('training.questions.col.source') },
		{ key: 'hidden', label: t('training.questions.col.hidden') }
	]);
	const filters = $derived<Filter[]>([
		{
			key: 'topic',
			label: t('training.questions.filter.topic'),
			options: data.topics.map((topic) => ({ value: topic.id, label: local(topic.title) }))
		},
		{
			key: 'state',
			label: t('training.questions.filter.state'),
			options: [
				{ value: 'visible', label: t('training.questions.state.visible') },
				{ value: 'hidden', label: t('training.questions.state.hidden') }
			]
		}
	]);
	const { stats } = $derived(data);
	const short = $derived(
		stats.inTopic === null ? stats.visible < stats.quizSize : stats.inTopic < stats.perTopic
	);
</script>

<svelte:head>
	<title>{t('training.tab.questions')}: {local(data.course.title)} — {t('admin.title')}</title>
</svelte:head>

<div class="mb-4 flex justify-end">
	<a
		href="{base}/new"
		class="inline-flex min-h-11 items-center rounded-md bg-navy-700 px-4 font-bold text-surface hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 sm:min-h-10"
		>{t('training.questions.create')}</a
	>
</div>

<FilterBar {filters} state={data.state} searchLabel={t('training.questions.search')} />

<p class="mb-4 text-sm {short ? 'font-bold text-error-fg' : 'text-ink-700'}">
	{#if stats.inTopic === null}
		{t('training.questions.total', { count: stats.visible, size: stats.quizSize })}
	{:else}
		{t('training.questions.inTopic', { count: stats.inTopic, need: stats.perTopic })}
	{/if}
</p>

<DataTable rows={data.rows} {columns} caption={t('training.tab.questions')}>
	{#snippet cell(row, column)}
		{#if column.key === 'number'}{row.number}
		{:else if column.key === 'topic'}
			{row.topicHidden
				? t('training.lessons.hiddenTopic', { topic: local(row.topicTitle) })
				: local(row.topicTitle)}
		{:else if column.key === 'text'}
			<a class="font-bold text-navy-700 underline-offset-2 hover:underline" href="{base}/{row.id}"
				>{start(row.text)}</a
			>
		{:else if column.key === 'correct'}{local(row.correct)}
		{:else if column.key === 'source'}{row.source ?? '—'}
		{:else if column.key === 'hidden'}
			{#if row.hidden}<Badge tone="warning">{t('training.questions.hidden')}</Badge>{/if}
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={ListChecks} title={t('training.questions.empty')} />
	{/snippet}
</DataTable>
