<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Button from '#lib/components/ui/Button.svelte';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { precheck, uploadPdf } from './upload-pdf';

	/* docs/05 section 27: one PDF per lesson in the private bucket; replacing removes the old file. */
	let {
		fileName,
		url,
		message
	}: { fileName: string | null; url: string | null; message?: MessageKey } = $props();

	let busy = $state(false);
	let problem = $state<MessageKey | null>(null);
	let done = $state(false);
	let input: HTMLInputElement | undefined = $state();

	async function pick(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		done = false;
		problem = precheck(file);
		if (!problem) {
			busy = true;
			problem = await uploadPdf(file);
			busy = false;
			done = !problem;
			if (done) await invalidateAll();
		}
		if (input) input.value = '';
	}
</script>

<section class="mb-6 rounded-md border border-line p-4" aria-labelledby="lesson-pdf">
	<h3 id="lesson-pdf" class="mb-1 font-bold">{t('training.lesson.pdf')}</h3>
	<p class="mb-3 text-sm text-ink-700">{t('training.lesson.pdfHint')}</p>
	{#if fileName}
		<p class="mb-3">
			{#if url}
				<a class="text-navy-700 underline" href={url} target="_blank" rel="noopener"
					>{t('training.lesson.pdfOpen')}: {fileName}</a
				>
			{:else}{fileName}{/if}
		</p>
	{:else}
		<p class="mb-3 text-ink-700">{t('training.lesson.pdfNone')}</p>
	{/if}
	<div class="flex flex-wrap items-center gap-3">
		<label class="inline-flex">
			<span class="sr-only"
				>{t(fileName ? 'training.lesson.pdfReplace' : 'training.lesson.pdfUpload')}</span
			>
			<input
				bind:this={input}
				type="file"
				accept="application/pdf"
				disabled={busy}
				onchange={pick}
				class="text-sm file:mr-3 file:min-h-10 file:rounded-md file:border-0 file:bg-navy-700 file:px-4 file:font-bold file:text-surface"
			/>
		</label>
		{#if fileName}
			<form method="POST" action="?/pdfRemove">
				<Button type="submit" variant="secondary" size="sm">{t('training.lesson.pdfRemove')}</Button
				>
			</form>
		{/if}
	</div>
	<p class="mt-2 text-sm" role="status" aria-live="polite">
		{#if busy}{t('training.lesson.pdfUploading')}
		{:else if problem}<span class="text-error-fg">{t(problem)}</span>
		{:else if message}<span class="text-error-fg">{t(message)}</span>
		{:else if done}{t('training.lesson.pdfDone')}{/if}
	</p>
</section>
