<script lang="ts">
	import ImageIcon from '@lucide/svelte/icons/image';
	import Button from '#lib/components/ui/Button.svelte';
	import Modal from '#lib/components/ui/Modal.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { ITEM_IMAGES_MAX } from '#lib/validation/shop-limits.ts';

	/* docs/05 section 14: several photos from the media library, in order (the first is the cover);
	 * the order is changed by buttons (docs/todo.md 7.4, decision 6). The server re-checks each key. */
	type Image = { key: string; name: string; url: string | null };
	let { initial, images, error }: { initial: string[]; images: Image[]; error?: string } = $props();

	let picked: string[] | null = $state(null);
	const keys = $derived(picked ?? initial);
	let open = $state(false);
	const byKey = $derived(new Map(images.map((i) => [i.key, i])));
	const id = $props.id();

	const move = (from: number, to: number) => {
		const next = [...keys];
		[next[from], next[to]] = [next[to], next[from]];
		picked = next;
	};
</script>

<div class="flex flex-col gap-2" role="group" aria-labelledby="{id}-label">
	<span id="{id}-label" class="text-sm font-bold text-ink-900">{t('shop.item.photos')}</span>
	{#each keys as key, i (key)}<input type="hidden" name="imageKeys.{i}" value={key} />{/each}
	{#if keys.length === 0}
		<p class="text-sm text-ink-700">{t('shop.item.photosEmpty')}</p>
	{:else}
		<ol class="flex flex-wrap gap-3">
			{#each keys as key, i (key)}
				{@const image = byKey.get(key)}
				<li class="flex w-40 flex-col gap-1 rounded-md border border-line p-2">
					<div class="flex h-24 items-center justify-center overflow-hidden rounded-sm bg-navy-100">
						{#if image?.url}<img src={image.url} alt="" class="size-full object-cover" />
						{:else}<span class="p-1 text-xs break-all">{image?.name ?? key}</span>{/if}
					</div>
					<div class="flex flex-wrap gap-1">
						{#if i > 0}
							<Button variant="ghost" size="sm" onclick={() => move(i, i - 1)}
								>{t('shop.item.photoEarlier')}</Button
							>
						{/if}
						{#if i < keys.length - 1}
							<Button variant="ghost" size="sm" onclick={() => move(i, i + 1)}
								>{t('shop.item.photoLater')}</Button
							>
						{/if}
						<Button
							variant="ghost"
							size="sm"
							onclick={() => (picked = keys.filter((k) => k !== key))}
							>{t('shop.item.photoRemove')}</Button
						>
					</div>
				</li>
			{/each}
		</ol>
	{/if}
	{#if keys.length < ITEM_IMAGES_MAX}
		<div>
			<Button variant="secondary" size="sm" onclick={() => (open = true)}
				>{t('shop.item.photoAdd')}</Button
			>
		</div>
	{/if}
	<p class="text-sm text-ink-700">{t('shop.item.photosHint')}</p>
	{#if error}<p class="text-sm text-error-fg">{error}</p>{/if}
</div>

<Modal bind:open title={t('shop.item.photoAdd')}>
	{#if images.length === 0}
		<p class="text-ink-700">{t('news.coverEmpty')}</p>
	{:else}
		<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3">
			{#each images.filter((img) => !keys.includes(img.key)) as image (image.key)}
				<li>
					<button
						type="button"
						class="flex w-full flex-col overflow-hidden rounded-md border border-line text-left hover:border-navy-600 focus-visible:outline-2 focus-visible:outline-navy-600"
						onclick={() => {
							picked = [...keys, image.key];
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
