<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const back = $derived(`/admin/training/${data.course.id}/lessons/${data.lesson.id}`);
</script>

<svelte:head>
	<title>{t('training.lesson.preview')}: {data.lesson.title} — {t('admin.title')}</title>
</svelte:head>

<p role="status" class="mb-6 rounded-md bg-warning-bg p-3 text-sm text-warning-fg">
	{t('training.lesson.previewBanner')}
	<a class="ml-2 font-bold underline" href={back}>{t('training.lesson.back')}</a>
</p>

<article class="mx-auto max-w-3xl">
	<h2 class="mb-4 text-2xl font-bold">{data.lesson.title}</h2>
	{#if data.lesson.html}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<div class="rich-text">{@html data.lesson.html}</div>
	{/if}
	{#if data.lesson.fileName}
		<p class="mt-6">
			{#if data.pdfUrl}
				<a
					class="font-bold text-navy-700 underline"
					href={data.pdfUrl}
					target="_blank"
					rel="noopener">{t('training.lesson.pdfOpen')}: {data.lesson.fileName}</a
				>
			{:else}{t('training.lesson.pdf')}: {data.lesson.fileName}{/if}
		</p>
	{/if}
</article>
