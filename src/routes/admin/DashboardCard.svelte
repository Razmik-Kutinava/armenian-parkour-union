<script lang="ts">
	import type { Snippet } from 'svelte';

	/* docs/05 section 3: one block of the dashboard. */
	let { title, children }: { title: string; children: Snippet } = $props();
	const id = $props.id();
</script>

<section aria-labelledby={id} class="rounded-lg border border-line bg-surface p-4">
	<h2 {id} class="mb-3 text-lg font-bold">{title}</h2>
	{@render children()}
</section>
