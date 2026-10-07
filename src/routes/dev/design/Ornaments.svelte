<script lang="ts">
	import Ornament, { type OrnamentVariant } from '#lib/components/Ornament.svelte';

	let { selected = $bindable() }: { selected: OrnamentVariant } = $props();

	const variants: { id: OrnamentVariant; name: string; note: string }[] = [
		{ id: 'rhombus', name: 'Carpet rhombus', note: 'Double rhombus from carpet borders' },
		{ id: 'interlace', name: 'Interlace', note: 'Plaited band, good for dividers' },
		{ id: 'pomegranate', name: 'Pomegranate', note: 'Pomegranate with crown and seeds' }
	];
</script>

<div class="grid gap-6 md:grid-cols-3">
	{#each variants as v (v.id)}
		<button
			class="flex flex-col overflow-hidden rounded-md border-2 bg-surface text-left {selected ===
			v.id
				? 'border-navy-700'
				: 'border-line'}"
			onclick={() => (selected = v.id)}
		>
			<div class="relative h-32 bg-navy-950">
				<Ornament variant={v.id} class="absolute inset-0 text-navy-300 opacity-20" />
			</div>
			<div class="relative h-20 bg-navy-50">
				<Ornament variant={v.id} class="absolute inset-0 text-navy-700 opacity-15" />
			</div>
			<div class="h-4 text-navy-500">
				<Ornament variant="interlace" class="h-4 w-full opacity-60" />
			</div>
			<p class="p-4 text-sm"><b>{v.name}</b> — {v.note}</p>
		</button>
	{/each}
</div>
