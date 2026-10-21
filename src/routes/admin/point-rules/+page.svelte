<script lang="ts">
	import Scale from '@lucide/svelte/icons/scale';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import Thresholds from './Thresholds.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 13: rules are edited, never created or deleted here. */
	let { data, form }: PageProps = $props();
	const columns = $derived<Column[]>([
		{ key: 'code', label: t('pointRules.col.code') },
		{ key: 'title', label: t('pointRules.col.title') },
		{ key: 'points', label: t('pointRules.col.points'), class: 'text-right' },
		{ key: 'active', label: t('pointRules.col.active') },
		{ key: 'updated', label: t('pointRules.col.updated') }
	]);
</script>

<svelte:head><title>{t('admin.nav.pointRules')} — {t('admin.title')}</title></svelte:head>

<h1 class="mb-2 text-2xl font-bold">{t('admin.nav.pointRules')}</h1>
<p class="mb-6 max-w-3xl text-sm text-ink-700">{t('pointRules.hint')}</p>

<DataTable rows={data.rules} {columns} caption={t('admin.nav.pointRules')}>
	{#snippet cell(row, column)}
		{#if column.key === 'code'}
			<a
				class="font-mono font-bold text-navy-700 underline-offset-2 hover:underline"
				href="/admin/point-rules/{row.id}">{row.code}</a
			>
		{:else if column.key === 'title'}{pickLocalized(row.title, currentLocale())}
		{:else if column.key === 'points'}{row.points}
		{:else if column.key === 'active'}
			{#if row.isActive}{t('pointRules.yes')}{:else}<Badge>{t('pointRules.off')}</Badge>{/if}
		{:else if column.key === 'updated'}
			<span class="whitespace-nowrap">{row.updatedAt.toLocaleString(currentLocale())}</span><br />
			<span class="text-sm text-ink-700">{row.updatedByName ?? t('pointRules.seed')}</span>
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={Scale} title={t('pointRules.empty')} />
	{/snippet}
</DataTable>

<Thresholds values={form?.values ?? data.thresholds} {form} />
