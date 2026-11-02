<script lang="ts">
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import { newsDate } from '#lib/components/site/news-date.ts';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const c = $derived(data.card);
	const local = (text: Parameters<typeof pickLocalized>[0]) => pickLocalized(text, currentLocale());
	const tone = { pending: 'info', approved: 'success', rejected: 'warning' } as const;
	let dialog = $state<'approve' | 'reject'>('approve');
	let open = $state(false);
	const ask = (action: 'approve' | 'reject') => {
		dialog = action;
		open = true;
	};
</script>

<svelte:head
	><title>{c.name} — {t('admin.nav.volunteerReports')} — {t('admin.title')}</title></svelte:head
>

<a href="/admin/volunteer/reports" class="text-sm text-navy-700 underline-offset-2 hover:underline"
	>{t('volunteer.reports.back')}</a
>
<div class="mb-4 flex flex-wrap items-center gap-3">
	<h1 class="text-2xl font-bold">{c.name}</h1>
	<Badge tone={tone[c.status]}>{t(`volunteer.reports.status.${c.status}`)}</Badge>
</div>
<p class="mb-4 text-ink-700">
	{local(c.requestTitle)} · {newsDate(c.date, currentLocale())}
	{#if c.note}<br />{c.note}{/if}
	{#if c.reviewNote}<br />{c.reviewNote}{/if}
</p>

{#if form?.done}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t(`volunteer.reports.done.${form.done}`)}
	</p>
{:else if form?.message}
	<p role="alert" class="mb-4 rounded-md bg-error-bg p-3 text-sm text-error-fg">
		{t(form.message)}
	</p>
{/if}

<div class="grid gap-6 lg:grid-cols-2">
	<section class="flex flex-col gap-3">
		{#if c.url}
			<a class="text-navy-700 underline" href={c.url} target="_blank" rel="noopener noreferrer"
				>{t('volunteer.reports.openLink')}</a
			>
		{:else if c.fileUrl}
			<a class="text-navy-700 underline" href={c.fileUrl} target="_blank" rel="noopener noreferrer"
				>{t('volunteer.reports.openPhoto')}</a
			>
			<img src={c.fileUrl} alt="" class="max-h-96 max-w-full rounded-md object-contain" />
		{/if}
		{#if c.own}
			<p class="rounded-md bg-info-bg p-3 text-sm text-info-fg">{t('volunteer.reports.own')}</p>
		{:else if c.status === 'pending'}
			<div class="flex flex-wrap gap-2">
				<Button onclick={() => ask('approve')}>{t('volunteer.reports.approve')}</Button>
				<Button variant="danger" onclick={() => ask('reject')}
					>{t('volunteer.reports.reject')}</Button
				>
			</div>
		{/if}
	</section>
	<section class="flex flex-col gap-3">
		<h2 class="text-xl font-bold">{t('volunteer.reports.history')}</h2>
		<ul class="flex flex-col gap-2">
			{#each c.history as h (h.id)}
				<li class="text-sm">
					{newsDate(h.date, currentLocale())} — {t(`volunteer.reports.status.${h.status}`)}
					{#if h.url}
						·
						<a
							class="text-navy-700 underline"
							href={h.url}
							target="_blank"
							rel="noopener noreferrer">{t('volunteer.reports.openLink')}</a
						>
					{:else if h.hasFile}
						· {t('volunteer.reports.hasPhoto')}
					{/if}
					{#if h.note}<p class="text-ink-700">{h.note}</p>{/if}
					{#if h.reviewNote}<p class="text-ink-700">{h.reviewNote}</p>{/if}
				</li>
			{/each}
		</ul>
	</section>
</div>

<ConfirmDialog
	bind:open
	title={t(`volunteer.reports.${dialog}Title`)}
	text={t(`volunteer.reports.${dialog}Text`)}
	action="?/{dialog}"
	confirmLabel={t(`volunteer.reports.${dialog}`)}
	danger={dialog === 'reject'}
	comment={dialog === 'reject' ? 'required' : 'optional'}
>
	{#snippet fields()}<input type="hidden" name="shown" value={c.shown} />{/snippet}
</ConfirmDialog>
