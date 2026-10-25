<script lang="ts">
	import Clapperboard from '@lucide/svelte/icons/clapperboard';
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import FilterBar, { type Filter } from '#lib/components/admin/FilterBar.svelte';
	import Pagination from '#lib/components/admin/Pagination.svelte';
	import { newsDate } from '#lib/components/site/news-date.ts';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import type { SubmitFunction } from '$app/forms';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import VideoActions from './VideoActions.svelte';
	import VideoStatus from './VideoStatus.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 11: the queue with filters in the URL, quick buttons and a batch. */
	let { data, form }: PageProps = $props();

	let selected = $state<string[]>([]);
	let rejectIds = $state<string[]>([]);
	let rejectOpen = $state(false);

	const statuses = ['pending', 'approved', 'hidden', 'rejected'] as const;
	const columns = $derived<Column[]>([
		{ key: 'member', label: t('videos.admin.col.member') },
		{ key: 'video', label: t('videos.admin.col.video') },
		{ key: 'platform', label: t('videos.admin.col.platform') },
		{ key: 'event', label: t('videos.admin.col.event') },
		{ key: 'createdAt', label: t('videos.admin.col.createdAt'), sortable: true },
		{ key: 'status', label: t('videos.admin.col.status') },
		{ key: 'actions', label: t('videos.admin.col.actions') }
	]);
	const filters = $derived<Filter[]>([
		{
			key: 'status',
			label: t('videos.admin.col.status'),
			options: [
				...statuses.map((s) => ({ value: s, label: t(`videos.status.${s}`) })),
				{ value: 'all', label: t('videos.admin.filter.all') }
			]
		},
		{
			key: 'platform',
			label: t('videos.admin.col.platform'),
			options: (['youtube', 'instagram'] as const).map((p) => ({
				value: p,
				label: t(`videos.platform.${p}`)
			}))
		}
	]);
	const chosen = $derived(data.rows.filter((r) => selected.includes(r.id)));
	const own = (userId: string) => userId === data.viewerId;
	const openReject = (ids: string[]) => {
		rejectIds = ids;
		rejectOpen = true;
	};
	const after: SubmitFunction =
		() =>
		async ({ result, update }) => {
			if (result.type === 'success') selected = [];
			await update();
		};
</script>

<svelte:head><title>{t('admin.nav.videos')} — {t('admin.title')}</title></svelte:head>

<h1 class="mb-6 text-2xl font-bold">{t('admin.nav.videos')}</h1>

{#if form?.message}
	<p role="alert" class="mb-4 rounded-md bg-error-bg p-3 text-sm text-error-fg">
		{t(form.message)}
	</p>
{:else if form}
	{@const skipped = form.skipped ?? 0}
	<div role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		<p>{t('videos.admin.result', { done: form.done ?? 0, skipped })}</p>
		{#if skipped > 0}<p>{t('videos.admin.skippedHint')}</p>{/if}
	</div>
{/if}

<FilterBar {filters} state={data.state} searchLabel={t('videos.admin.search')} />

{#if chosen.length}
	<div
		class="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-line bg-navy-50 p-3"
		aria-label={t('videos.admin.selected', { count: chosen.length })}
		role="group"
	>
		<span class="text-sm font-bold">{t('videos.admin.selected', { count: chosen.length })}</span>
		<VideoActions
			ids={chosen.map((r) => r.id)}
			labels="selected"
			approve={chosen.some((r) => r.status === 'pending')}
			hide={chosen.some((r) => r.status === 'approved')}
			onReject={chosen.some((r) => r.status === 'pending')
				? () => openReject(chosen.map((r) => r.id))
				: undefined}
			{after}
		/>
	</div>
{/if}

<DataTable
	rows={data.rows}
	{columns}
	caption={t('admin.nav.videos')}
	state={data.state}
	selectable
	bind:selected
>
	{#snippet cell(row, column)}
		{#if column.key === 'member'}
			<a
				class="font-bold text-navy-700 underline-offset-2 hover:underline"
				href="/admin/users/{row.userId}">{row.memberName}</a
			>
		{:else if column.key === 'video'}
			<a
				href={row.url}
				target="_blank"
				rel="noopener noreferrer"
				title={t('videos.admin.openHint')}
				class="text-navy-700 underline underline-offset-2 hover:text-navy-600"
				>{row.title ?? t('videos.admin.untitled')}</a
			>
			{#if row.rejectReason}<p class="text-xs text-ink-700">{row.rejectReason}</p>{/if}
		{:else if column.key === 'platform'}{t(`videos.platform.${row.platform}`)}
		{:else if column.key === 'event'}{row.eventTitle
				? pickLocalized(row.eventTitle, currentLocale())
				: '—'}
		{:else if column.key === 'createdAt'}{newsDate(row.createdAt, currentLocale())}
		{:else if column.key === 'status'}<VideoStatus status={row.status} />
		{:else if column.key === 'actions'}
			<VideoActions
				ids={[row.id]}
				approve={row.status === 'pending' && !own(row.userId)}
				hide={row.status === 'approved'}
				onReject={row.status === 'pending' && !own(row.userId)
					? () => openReject([row.id])
					: undefined}
				{after}
			/>
		{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={Clapperboard} title={t('videos.admin.empty')} />
	{/snippet}
</DataTable>

<div class="mt-4"><Pagination total={data.total} current={data.state.page} /></div>

<ConfirmDialog
	bind:open={rejectOpen}
	title={t('videos.admin.rejectTitle', { count: rejectIds.length })}
	text={t('videos.admin.rejectText')}
	action="?/reject"
	confirmLabel={t('videos.admin.reject')}
	danger
	comment="required"
>
	{#snippet fields()}
		{#each rejectIds as id (id)}<input type="hidden" name="ids" value={id} />{/each}
	{/snippet}
</ConfirmDialog>
