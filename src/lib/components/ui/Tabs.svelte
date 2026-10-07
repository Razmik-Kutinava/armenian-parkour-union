<script lang="ts">
	import type { Snippet } from 'svelte';
	import { nextTabIndex } from './tabs';

	type Tab = { id: string; label: string };

	let {
		tabs,
		value = $bindable(tabs[0]?.id),
		label,
		panel
	}: {
		tabs: Tab[];
		value?: string;
		/** Accessible name of the tab list. */
		label: string;
		panel: Snippet<[string]>;
	} = $props();

	const id = $props.id();
	const buttons: HTMLButtonElement[] = [];

	function onkeydown(event: KeyboardEvent, index: number) {
		const next = nextTabIndex(event.key, index, tabs.length);
		if (next === null) return;
		event.preventDefault();
		value = tabs[next].id;
		buttons[next]?.focus();
	}
</script>

<div>
	<div role="tablist" aria-label={label} class="flex overflow-x-auto border-b border-line">
		{#each tabs as tab, i (tab.id)}
			{@const selected = tab.id === value}
			<button
				bind:this={buttons[i]}
				type="button"
				role="tab"
				id="{id}-tab-{tab.id}"
				aria-selected={selected}
				aria-controls="{id}-panel"
				tabindex={selected ? 0 : -1}
				onclick={() => (value = tab.id)}
				onkeydown={(e) => onkeydown(e, i)}
				class="-mb-px shrink-0 border-b-2 px-4 py-3 text-base whitespace-nowrap transition-colors duration-(--dur-fast) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-navy-600 {selected
					? 'border-accent-500 font-bold text-navy-700'
					: 'border-transparent text-ink-700 hover:text-ink-900'}"
			>
				{tab.label}
			</button>
		{/each}
	</div>
	<div id="{id}-panel" role="tabpanel" aria-labelledby="{id}-tab-{value}" tabindex="0" class="pt-6">
		{@render panel(value ?? '')}
	</div>
</div>
