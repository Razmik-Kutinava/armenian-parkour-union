<script lang="ts">
	import FileText from '@lucide/svelte/icons/file-text';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import type { PageProps } from './$types';

	/* docs/05 section 19: title, address, status, when changed. */
	let { data }: PageProps = $props();
	const columns = $derived<Column[]>([
		{ key: 'title', label: t('pages.col.title') },
		{ key: 'slug', label: t('pages.col.slug') },
		{ key: 'status', label: t('pages.col.status') },
		{ key: 'updatedAt', label: t('pages.col.updated'), class: 'whitespace-nowrap' }
	]);
	const tones = { draft: 'neutral', published: 'success', archived: 'warning' } as const;
</script>

<svelte:head><title>{t('admin.nav.pages')} — {t('admin.title')}</title></svelte:head>

<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-bold">{t('admin.nav.pages')}</h1>
	<a
		href="/admin/pages/new"
		class="text-white inline-flex min-h-11 items-center rounded-md bg-navy-700 px-4 font-bold hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 sm:min-h-10"
		>{t('pages.create')}</a
	>
</div>

<DataTable rows={data.rows} {columns} caption={t('admin.nav.pages')}>
	{#snippet cell(row, column)}
		{#if column.key === 'title'}
			<a
				class="font-bold text-navy-700 underline-offset-2 hover:underline"
				href="/admin/pages/{row.id}">{pickLocalized(row.title, currentLocale())}</a
			>
			{#if row.isSystem}<Badge tone="info">{t('pages.system')}</Badge>{/if}
		{:else if column.key === 'slug'}<code class="text-ink-700">{row.slug}</code>
		{:else if column.key === 'status'}
			<Badge tone={tones[row.status]}>{t(`pages.status.${row.status}`)}</Badge>
		{:else if column.key === 'updatedAt'}{row.updatedAt.toLocaleDateString(currentLocale())}
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={FileText} title={t('pages.empty')} />
	{/snippet}
</DataTable>
