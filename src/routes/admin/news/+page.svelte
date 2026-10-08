<script lang="ts">
	import Newspaper from '@lucide/svelte/icons/newspaper';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import FilterBar, { type Filter } from '#lib/components/admin/FilterBar.svelte';
	import Pagination from '#lib/components/admin/Pagination.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import type { PageProps } from './$types';

	/* docs/05 section 18: cover, title, status, date, author; filters status, tag, period; search. */
	let { data }: PageProps = $props();
	const listState = $derived(data.state);
	const columns = $derived<Column[]>([
		{ key: 'cover', label: t('news.col.cover') },
		{ key: 'title', label: t('news.col.title') },
		{ key: 'status', label: t('news.col.status') },
		{ key: 'publishedAt', label: t('news.col.date'), class: 'whitespace-nowrap' },
		{ key: 'author', label: t('news.col.author') }
	]);
	const statuses = ['draft', 'published', 'scheduled', 'archived'] as const;
	const label = (s: (typeof statuses)[number]) =>
		s === 'scheduled' ? t('news.status.scheduled') : t(`pages.status.${s}`);
	const filters = $derived<Filter[]>([
		{
			key: 'status',
			label: t('news.col.status'),
			options: statuses.map((s) => ({ value: s, label: label(s) }))
		},
		{
			key: 'tag',
			label: t('news.filter.tag'),
			options: data.tags.map((tag) => ({ value: tag, label: tag }))
		},
		{ key: 'from', label: t('news.filter.from'), type: 'date' },
		{ key: 'to', label: t('news.filter.to'), type: 'date' }
	]);
	const tones = { draft: 'neutral', published: 'success', archived: 'warning' } as const;
	const date = (d: Date) =>
		d.toLocaleString(currentLocale(), { dateStyle: 'medium', timeStyle: 'short' });
</script>

<svelte:head><title>{t('admin.nav.news')} — {t('admin.title')}</title></svelte:head>

<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-bold">{t('admin.nav.news')}</h1>
	<a
		href="/admin/news/new"
		class="text-white inline-flex min-h-11 items-center rounded-md bg-navy-700 px-4 font-bold hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 sm:min-h-10"
		>{t('news.create')}</a
	>
</div>

<FilterBar {filters} state={listState} searchLabel={t('news.search')} />

<DataTable rows={data.rows} {columns} caption={t('admin.nav.news')} state={listState}>
	{#snippet cell(row, column)}
		{#if column.key === 'cover'}
			<div class="h-10 w-16 overflow-hidden rounded-sm bg-navy-100">
				{#if row.coverUrl}<img src={row.coverUrl} alt="" class="size-full object-cover" />{/if}
			</div>
		{:else if column.key === 'title'}
			<a
				class="font-bold text-navy-700 underline-offset-2 hover:underline"
				href="/admin/news/{row.id}">{pickLocalized(row.title, currentLocale())}</a
			>
		{:else if column.key === 'status'}
			{#if row.scheduled}<Badge tone="info">{t('news.status.scheduled')}</Badge>
			{:else}<Badge tone={tones[row.status]}>{t(`pages.status.${row.status}`)}</Badge>{/if}
		{:else if column.key === 'publishedAt'}{row.publishedAt ? date(row.publishedAt) : '—'}
		{:else if column.key === 'author'}{row.authorName ?? '—'}
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={Newspaper} title={t('news.empty')} />
	{/snippet}
</DataTable>

<div class="mt-4"><Pagination total={data.total} current={listState.page} /></div>
