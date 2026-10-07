<script lang="ts">
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowUpDown from '@lucide/svelte/icons/arrow-up-down';
	import type { SortDir } from './list-state';

	let { dir }: { dir: SortDir | null } = $props();
</script>

{#if dir === 'asc'}
	<ArrowUp class="size-4" aria-hidden="true" />
{:else if dir === 'desc'}
	<ArrowDown class="size-4" aria-hidden="true" />
{:else}
	<ArrowUpDown class="size-4 text-ink-500" aria-hidden="true" />
{/if}
