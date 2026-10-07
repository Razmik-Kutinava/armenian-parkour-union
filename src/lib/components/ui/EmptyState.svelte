<script lang="ts">
	import type { LucideIcon } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	let {
		icon: Icon,
		title,
		text,
		action
	}: {
		icon: LucideIcon;
		title: string;
		text?: string;
		action?: Snippet;
	} = $props();
</script>

<div
	class="flex flex-col items-center gap-3 rounded-md border border-dashed border-line bg-surface px-6 py-12 text-center"
>
	<div class="flex size-12 items-center justify-center rounded-full bg-navy-100 text-navy-700">
		<Icon class="size-6" aria-hidden="true" />
	</div>
	<h3 class="text-xl font-bold text-ink-900">{title}</h3>
	{#if text}
		<p class="max-w-md text-base text-ink-700">{text}</p>
	{/if}
	{#if action}
		<div class="pt-2">{@render action()}</div>
	{/if}
</div>
