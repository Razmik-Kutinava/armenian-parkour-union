<script lang="ts">
	import Ornament, { type OrnamentVariant } from '#lib/components/Ornament.svelte';

	const variants: { id: OrnamentVariant; note: string }[] = [
		{ id: 'rhombus', note: 'Main: hero, footer, dividers' },
		{ id: 'pomegranate', note: 'Secondary: photo placeholders' }
	];
</script>

<div class="grid gap-6 md:grid-cols-2">
	{#each variants as v (v.id)}
		<div class="overflow-hidden rounded-md border border-line bg-surface">
			<div class="relative h-32 bg-navy-950">
				<Ornament variant={v.id} class="absolute inset-0 text-navy-300 opacity-20" />
			</div>
			<div class="relative h-20 bg-navy-50">
				<Ornament variant={v.id} class="absolute inset-0 text-navy-700 opacity-15" />
			</div>
			<p class="p-4 text-sm"><b>{v.id}</b> — {v.note}</p>
		</div>
	{/each}
</div>
