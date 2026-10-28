<script lang="ts">
	import Clapperboard from '@lucide/svelte/icons/clapperboard';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickPortal } from '#lib/i18n/localized.ts';
	import type { PageProps } from './$types';

	/* docs/05 section 27 "Practice tasks": by order; hide / restore; videos per task. */
	let { data, form }: PageProps = $props();
	const base = $derived(`/admin/training/${data.course.id}/tasks`);
	const columns = $derived<Column[]>(
		(['title', 'order', 'videos', 'actions'] as const).map((key) => ({
			key,
			label: t(`training.tasks.col.${key}`)
		}))
	);
	const local = (text: Parameters<typeof pickPortal>[0]) => pickPortal(text, currentLocale());
</script>

<svelte:head>
	<title>{t('training.tab.tasks')}: {local(data.course.title)} — {t('admin.title')}</title>
</svelte:head>

<div class="mb-4 flex flex-wrap items-start justify-between gap-3">
	<p class="max-w-2xl text-sm text-ink-700">{t('training.tasks.hint')}</p>
	<a
		href="{base}/new"
		class="inline-flex min-h-11 items-center rounded-md bg-navy-700 px-4 font-bold text-surface hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 sm:min-h-10"
		>{t('training.tasks.create')}</a
	>
</div>

{#if form && 'stateError' in form}
	<p role="alert" class="mb-4 rounded-md bg-error-bg p-3 text-sm text-error-fg">
		{t('training.tasks.error.state')}
	</p>
{:else if form && 'saved' in form}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t('users.saved')}
	</p>
{/if}

<DataTable rows={data.tasks} {columns} caption={t('training.tab.tasks')}>
	{#snippet cell(row, column)}
		{#if column.key === 'title'}
			<a class="font-bold text-navy-700 underline-offset-2 hover:underline" href="{base}/{row.id}"
				>{local(row.title)}</a
			>
			{#if row.hiddenAt}<Badge tone="warning">{t('training.tasks.hidden')}</Badge>{/if}
		{:else if column.key === 'order'}{row.sortOrder}
		{:else if column.key === 'videos'}
			{t('training.tasks.counts', { pending: row.pending, accepted: row.accepted })}
		{:else if column.key === 'actions'}
			<form method="POST" action={row.hiddenAt ? '?/restore' : '?/hide'}>
				<input type="hidden" name="taskId" value={row.id} />
				<Button type="submit" variant="secondary" size="sm"
					>{t(row.hiddenAt ? 'training.tasks.restore' : 'training.tasks.hide')}</Button
				>
			</form>
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={Clapperboard} title={t('training.tasks.empty')} />
	{/snippet}
</DataTable>
