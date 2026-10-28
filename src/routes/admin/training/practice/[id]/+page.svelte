<script lang="ts">
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import { newsDate } from '#lib/components/site/news-date.ts';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickPortal } from '#lib/i18n/localized.ts';
	import PracticeVideo from './PracticeVideo.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 27 "Practice": the video next to the task criteria and the earlier videos. */
	let { data, form }: PageProps = $props();
	const c = $derived(data.card);
	const local = (text: Parameters<typeof pickPortal>[0]) => pickPortal(text, currentLocale());
	const tone = { pending: 'info', approved: 'success', rejected: 'warning' } as const;
	let dialog = $state<'approve' | 'reject'>('approve');
	let open = $state(false);
	const ask = (action: 'approve' | 'reject') => {
		dialog = action;
		open = true;
	};
</script>

<svelte:head><title>{t('training.practice.title')} — {t('admin.title')}</title></svelte:head>

<a href="/admin/training/practice" class="text-sm text-navy-700 underline-offset-2 hover:underline"
	>{t('training.practice.back')}</a
>
<div class="mb-4 flex flex-wrap items-center gap-3">
	<h1 class="text-2xl font-bold">{c.name}: {local(c.task.title)}</h1>
	<Badge tone={tone[c.status]}>{t(`training.practice.status.${c.status}`)}</Badge>
</div>
<p class="mb-4 text-ink-700">
	{local(c.courseTitle)} · {newsDate(c.date, currentLocale())}
	{#if c.note}<br />{c.note}{/if}
</p>

{#if form?.done}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t(`training.practice.done.${form.done}`)}
	</p>
{:else if form?.message}
	<p role="alert" class="mb-4 rounded-md bg-error-bg p-3 text-sm text-error-fg">
		{t(form.message)}
	</p>
{/if}

<div class="grid gap-6 lg:grid-cols-2">
	<section class="flex flex-col gap-3">
		<PracticeVideo url={c.url} title={local(c.task.title)} />
		{#if c.own}
			<p class="rounded-md bg-info-bg p-3 text-sm text-info-fg">{t('training.practice.own')}</p>
		{:else if c.status === 'pending'}
			<div class="flex flex-wrap gap-2">
				<Button onclick={() => ask('approve')}>{t('training.practice.approve')}</Button>
				<Button variant="danger" onclick={() => ask('reject')}
					>{t('training.practice.reject')}</Button
				>
			</div>
		{/if}
	</section>
	<section class="flex flex-col gap-3">
		<h2 class="text-xl font-bold">{t('training.practice.criteria')}</h2>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<div class="rich-text">{@html local(c.task.description)}</div>
		<h2 class="text-xl font-bold">{t('training.practice.history')}</h2>
		<ul class="flex flex-col gap-2">
			{#each c.history as h (h.id)}
				<li class="text-sm">
					{newsDate(h.date, currentLocale())} — {t(`training.practice.status.${h.status}`)} ·
					<a class="text-navy-700 underline" href={h.url} target="_blank" rel="noopener noreferrer"
						>{t('training.practice.openLink')}</a
					>
					{#if h.note}<p class="text-ink-700">{h.note}</p>{/if}
				</li>
			{:else}
				<li class="text-sm text-ink-700">{t('training.practice.noHistory')}</li>
			{/each}
		</ul>
	</section>
</div>

<ConfirmDialog
	bind:open
	title={t(`training.practice.${dialog}Title`)}
	text={t(`training.practice.${dialog}Text`)}
	action="?/{dialog}"
	confirmLabel={t(`training.practice.${dialog}`)}
	danger={dialog === 'reject'}
	comment={dialog === 'reject' ? 'required' : 'optional'}
>
	{#snippet fields()}<input type="hidden" name="url" value={c.url} />{/snippet}
</ConfirmDialog>
