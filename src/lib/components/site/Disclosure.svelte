<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import type { Snippet } from 'svelte';

	/* <details> menu: works without JS; Esc and navigation close it (docs/08 section 8.1, Dropdown). */
	let {
		summary,
		children,
		class: className = '',
		summaryClass = ''
	}: { summary: Snippet; children: Snippet; class?: string; summaryClass?: string } = $props();

	let open = $state(false);
	let summaryEl: HTMLElement | undefined = $state();

	afterNavigate(() => {
		open = false;
	});

	function onkeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || !open) return;
		open = false;
		summaryEl?.focus();
	}
</script>

<svelte:window {onkeydown} />

<details class="relative {className}" bind:open>
	<summary
		bind:this={summaryEl}
		class="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md px-3 font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 [&::-webkit-details-marker]:hidden {summaryClass}"
	>
		{@render summary()}
	</summary>
	{@render children()}
</details>
