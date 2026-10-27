<script lang="ts">
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import LessonForm from '../LessonForm.svelte';
	import LessonPdf from './LessonPdf.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 27 "Lessons": the form, one PDF, preview of the saved version, soft delete. */
	let { data, form }: PageProps = $props();
	const values = $derived((form && 'values' in form && form.values) || data.values);
	const errors = $derived(form && 'errors' in form ? form.errors : undefined);
	const base = $derived(`/admin/training/${data.course.id}/lessons`);
	const title = $derived(pickLocalized(data.lesson.title, currentLocale()));
	let deleteOpen = $state(false);
</script>

<svelte:head><title>{title} — {t('admin.title')}</title></svelte:head>

<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
	<div>
		<a href={base} class="text-sm text-navy-700 underline-offset-2 hover:underline"
			>{t('training.lesson.back')}</a
		>
		<h2 class="text-xl font-bold">{title}</h2>
	</div>
	<a
		href="{base}/{data.lesson.id}/preview"
		target="_blank"
		class="inline-flex min-h-11 items-center rounded-md border border-navy-700 px-4 font-bold text-navy-700 hover:bg-navy-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 sm:min-h-10"
		>{t('training.lesson.preview')}</a
	>
</div>

{#if form && 'saved' in form}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t('users.saved')}
	</p>
{:else if form && 'pdf' in form && form.pdf === 'removed'}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t('training.lesson.pdfRemoved')}
	</p>
{/if}

<LessonPdf
	fileName={data.lesson.fileName}
	url={data.pdfUrl}
	message={form && 'message' in form ? form.message : undefined}
/>

{#key data.values}
	<LessonForm action="?/update" cancelHref={base} {values} {errors} topics={data.topics} />
{/key}

<div class="mt-6">
	<Button variant="danger" onclick={() => (deleteOpen = true)}>{t('training.lesson.delete')}</Button
	>
</div>

<ConfirmDialog
	bind:open={deleteOpen}
	title={t('training.lesson.delete')}
	text={t('training.lesson.deleteConfirm')}
	action="?/delete"
	confirmLabel={t('training.lesson.delete')}
	danger
/>
