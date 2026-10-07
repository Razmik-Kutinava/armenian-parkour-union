<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, text, children }: { title: string; text?: string; children: Snippet } = $props();
</script>

<section class="rounded-md border border-line bg-surface p-4 sm:p-6">
	<h2 class="text-lg font-bold text-ink-900">{title}</h2>
	{#if text}<p class="mt-1 text-sm text-ink-700">{text}</p>{/if}
	<div class="mt-4 flex flex-col gap-4">{@render children()}</div>
</section>
