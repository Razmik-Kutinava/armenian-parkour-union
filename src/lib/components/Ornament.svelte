<script lang="ts" module>
	/* Armenian geometric ornament, no crosses (docs/08-DESIGN.md, section 16). Colour = currentColor. */
	export type OrnamentVariant = 'rhombus' | 'interlace' | 'pomegranate';
</script>

<script lang="ts">
	let { variant, class: className = '' }: { variant: OrnamentVariant; class?: string } = $props();

	const id = $props.id();
	const tiles: Record<OrnamentVariant, { w: number; h: number }> = {
		rhombus: { w: 48, h: 48 },
		interlace: { w: 32, h: 16 },
		pomegranate: { w: 48, h: 56 }
	};
	const tile = $derived(tiles[variant]);
</script>

<svg class={className} aria-hidden="true" width="100%" height="100%">
	<defs>
		<pattern id="{id}-tile" width={tile.w} height={tile.h} patternUnits="userSpaceOnUse">
			<g fill="none" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round">
				{#if variant === 'rhombus'}
					<path d="M24 4 44 24 24 44 4 24Z" />
					<path d="M24 14 34 24 24 34 14 24Z" />
					<path d="M24 21 27 24 24 27 21 24Z" fill="currentColor" />
					{#each [[0, 0], [48, 0], [0, 48], [48, 48]] as [cx, cy], i (i)}
						<circle {cx} {cy} r="1.5" fill="currentColor" />
					{/each}
				{:else if variant === 'interlace'}
					<path d="M0 8C5 1 11 1 16 8S27 15 32 8" />
					<path d="M0 8C5 15 11 15 16 8S27 1 32 8" />
					<circle cx="8" cy="8" r="1" fill="currentColor" />
					<circle cx="24" cy="8" r="1" fill="currentColor" />
				{:else}
					<circle cx="24" cy="32" r="11" />
					<path d="M19 22 20 15 24 19 28 15 29 22" />
					{#each [[22, 28], [26, 28], [20, 32], [24, 32], [28, 32], [22, 36], [26, 36]] as [cx, cy], i (i)}
						<circle {cx} {cy} r="0.9" fill="currentColor" />
					{/each}
				{/if}
			</g>
		</pattern>
	</defs>
	<rect width="100%" height="100%" fill="url(#{id}-tile)" />
</svg>
