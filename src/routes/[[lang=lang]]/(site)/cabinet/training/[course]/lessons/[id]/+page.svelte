<script lang="ts">
	import { currentLocale, localizePath, t } from '#lib/i18n/index.svelte.ts';
	import { pickPortal } from '#lib/i18n/localized.ts';
	import PreviewBanner from '../../PreviewBanner.svelte';
	import type { PageProps } from './$types';

	/* docs/06 section 5.11: title, text with videos, "Download PDF" — a fresh signed link per click. */
	let { data }: PageProps = $props();
	const text = (value: Parameters<typeof pickPortal>[0]) => pickPortal(value, currentLocale());
	const portal = $derived(localizePath(`/cabinet/training/${data.course.slug}`, currentLocale()));
	const pdf = $derived(`${portal}/lessons/${data.lesson.id}/pdf`);
</script>

<svelte:head>
	<title>{text(data.lesson.title)} — {text(data.course.title)} — {t('site.name')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<article class="flex max-w-3xl flex-col gap-6">
	<a class="font-bold text-navy-700 underline hover:no-underline" href={portal}
		>{t('cabinet.training.backToCourse')}: {text(data.course.title)}</a
	>
	{#if data.preview}<PreviewBanner />{/if}
	<div>
		{#if data.lesson.topicTitle}
			<p class="text-sm text-ink-700">{text(data.lesson.topicTitle)}</p>
		{/if}
		<h1 class="text-3xl font-bold text-ink-900">{text(data.lesson.title)}</h1>
	</div>
	{#if data.lesson.html}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<div class="rich-text">{@html data.lesson.html}</div>
	{/if}
	{#if data.lesson.fileName}
		<a
			class="inline-flex min-h-11 w-fit items-center rounded-md bg-navy-700 px-4 font-bold text-surface hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600"
			href={pdf}
			data-sveltekit-reload>{t('cabinet.training.downloadPdf')}: {data.lesson.fileName}</a
		>
	{/if}
</article>
