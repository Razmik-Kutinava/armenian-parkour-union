<script lang="ts">
	import Upload from '@lucide/svelte/icons/upload';
	import { invalidateAll } from '$app/navigation';
	import Badge from '#lib/components/ui/Badge.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { MessageKey } from '#lib/i18n/translate.ts';
	import { mediaMimes } from '#lib/validation/media.ts';
	import { precheck, uploadFile } from './upload-file';

	/* docs/05 sections 1.9 and 20: several files at once, by the button or by dropping them. */
	type Item = {
		id: number;
		name: string;
		state: 'uploading' | 'done' | 'error';
		error?: MessageKey;
	};
	let items = $state<Item[]>([]);
	let dragging = $state(false);
	let nextId = 0;

	async function add(list: FileList | null | undefined) {
		const queue = [...(list ?? [])].map((file) => {
			const error = precheck(file);
			items.push({
				id: nextId++,
				name: file.name,
				state: error ? 'error' : 'uploading',
				error: error ?? undefined
			});
			return { file, item: items[items.length - 1] };
		});
		let uploaded = false;
		for (const { file, item } of queue) {
			if (item.state === 'error') continue;
			const error = await uploadFile(file).catch((): MessageKey => 'media.error.failed');
			item.state = error ? 'error' : 'done';
			item.error = error ?? undefined;
			uploaded ||= !error;
		}
		if (uploaded) await invalidateAll();
	}
</script>

<section class="mb-6" aria-labelledby="upload-title">
	<h2 id="upload-title" class="sr-only">{t('media.upload.title')}</h2>
	<label
		class="flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed px-6 py-8 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-navy-600 {dragging
			? 'border-navy-600 bg-navy-100'
			: 'border-line bg-surface'}"
		ondragover={(e) => {
			e.preventDefault();
			dragging = true;
		}}
		ondragleave={() => (dragging = false)}
		ondrop={(e) => {
			e.preventDefault();
			dragging = false;
			add(e.dataTransfer?.files);
		}}
	>
		<Upload class="size-6 text-navy-700" aria-hidden="true" />
		<span class="font-bold text-navy-700">{t('media.upload.choose')}</span>
		<span class="text-sm text-ink-700">{t('media.upload.hint')}</span>
		<input
			type="file"
			multiple
			accept={mediaMimes.join(',')}
			class="sr-only"
			onchange={(e) => {
				add(e.currentTarget.files);
				e.currentTarget.value = '';
			}}
		/>
	</label>
	{#if items.length > 0}
		<ul class="mt-3 flex flex-col gap-2" aria-live="polite">
			{#each items as item (item.id)}
				<li class="flex flex-wrap items-center gap-2 text-sm">
					<span class="font-bold break-all">{item.name}</span>
					{#if item.state === 'uploading'}
						<Badge tone="info">{t('media.upload.uploading')}</Badge>
					{:else if item.state === 'done'}
						<Badge tone="success">{t('media.upload.done')}</Badge>
					{:else if item.error}
						<span class="text-error-fg">{t(item.error)}</span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
