<script lang="ts">
	import { currentLocale, localizePath, t } from '#lib/i18n/index.svelte.ts';
	import { pickPortal } from '#lib/i18n/localized.ts';
	import PreviewBanner from '../PreviewBanner.svelte';
	import PracticeTask from './PracticeTask.svelte';
	import type { PageProps } from './$types';

	/* docs/06 section 5.11 "Practice": before the passed quiz — the list without a form; after — a
	 * link per task, the status and the history. */
	let { data, form }: PageProps = $props();
	const p = $derived(data.practice);
	const text = (value: Parameters<typeof pickPortal>[0]) => pickPortal(value, currentLocale());
	const portal = $derived(localizePath(`/cabinet/training/${p.course.slug}`, currentLocale()));
	const sentTo = $derived(form?.sent ? { taskId: form.taskId, sent: form.sent } : null);
	const failedAt = $derived(
		form?.error ? { taskId: form.taskId, url: form.url ?? '', error: form.error } : null
	);
</script>

<svelte:head>
	<title>{t('cabinet.practice.title')} — {text(p.course.title)} — {t('site.name')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex max-w-3xl flex-col gap-6">
	<a class="font-bold text-navy-700 underline hover:no-underline" href={portal}
		>{t('cabinet.training.backToCourse')}: {text(p.course.title)}</a
	>
	{#if p.preview}<PreviewBanner />{/if}
	<h1 class="text-3xl font-bold text-ink-900">{t('cabinet.practice.title')}</h1>
	<p class="font-bold text-ink-900">{t(`cabinet.practice.state.${p.state}`)}</p>
	{#if p.total > 0 && p.state !== 'preview'}
		<p class="text-ink-700">
			{t('cabinet.practice.progress', { accepted: p.accepted, total: p.total })}
		</p>
	{/if}

	{#each p.tasks as task (task.id)}
		<PracticeTask
			{task}
			open={p.state === 'open'}
			sent={sentTo?.taskId === task.id ? sentTo.sent : null}
			failed={failedAt?.taskId === task.id ? { url: failedAt.url, error: failedAt.error } : null}
		/>
	{:else}
		<p class="text-ink-700">{t('cabinet.practice.empty')}</p>
	{/each}
</div>
