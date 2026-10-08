<script lang="ts">
	import ImageIcon from '@lucide/svelte/icons/image';
	import Button from '#lib/components/ui/Button.svelte';
	import Modal from '#lib/components/ui/Modal.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';

	/* docs/05 section 18: the cover is chosen from the media library (images only). */
	type Image = { key: string; name: string; url: string | null };
	let { value = '', images, error }: { value?: string; images: Image[]; error?: string } = $props();

	let picked: string | null = $state(null);
	const key = $derived(picked ?? value);
	let open = $state(false);
	const chosen = $derived(images.find((i) => i.key === key));
	const id = $props.id();
</script>

<div class="flex flex-col gap-2" role="group" aria-labelledby="{id}-label">
	<span id="{id}-label" class="text-sm font-bold text-ink-900">{t('news.cover')}</span>
	<input type="hidden" name="coverKey" value={key} />
	<div class="flex flex-wrap items-center gap-3">
		<div
			class="flex h-24 w-40 items-center justify-center overflow-hidden rounded-md border border-line bg-navy-100"
		>
			{#if chosen?.url}
				<img src={chosen.url} alt="" class="size-full object-cover" />
			{:else if key}
				<span class="p-2 text-xs break-all text-ink-700">{chosen?.name ?? key}</span>
			{:else}
				<ImageIcon class="size-8 text-navy-700" aria-hidden="true" />
			{/if}
		</div>
		<div class="flex flex-col gap-2">
			<Button variant="secondary" size="sm" onclick={() => (open = true)}
				>{t('news.coverChoose')}</Button
			>
			{#if key}
				<Button variant="ghost" size="sm" onclick={() => (picked = '')}
					>{t('news.coverRemove')}</Button
				>
			{/if}
		</div>
	</div>
	<p class="text-sm text-ink-500">{t('news.coverHint')}</p>
	{#if error}<p class="text-sm text-error-fg">{error}</p>{/if}
</div>

<Modal bind:open title={t('news.coverChoose')}>
	{#if images.length === 0}
		<p class="text-ink-700">{t('news.coverEmpty')}</p>
	{:else}
		<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3">
			{#each images as image (image.key)}
				<li>
					<button
						type="button"
						class="flex w-full flex-col overflow-hidden rounded-md border border-line text-left hover:border-navy-600 focus-visible:outline-2 focus-visible:outline-navy-600"
						aria-pressed={image.key === key}
						onclick={() => {
							picked = image.key;
							open = false;
						}}
					>
						<span class="flex aspect-video items-center justify-center bg-navy-100">
							{#if image.url}
								<img src={image.url} alt="" loading="lazy" class="size-full object-cover" />
							{:else}
								<ImageIcon class="size-6 text-navy-700" aria-hidden="true" />
							{/if}
						</span>
						<span class="truncate p-2 text-xs">{image.name}</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</Modal>
