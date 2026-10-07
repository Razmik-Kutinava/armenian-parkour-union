<script lang="ts">
	const spaces = [1, 2, 3, 4, 6, 8, 12, 16, 24];
	const radii = ['sm', 'md', 'lg', 'full'];
	const shadows = ['sm', 'md', 'lg'];
	const durations = ['fast', 'base', 'slow'];
</script>

<div class="grid gap-8 lg:grid-cols-2">
	<div>
		<h3 class="mb-3 text-xl font-semibold">Spacing (4 px step)</h3>
		{#each spaces as n (n)}
			<div class="flex items-center gap-3 text-sm">
				<span class="w-20 text-ink-500">--space-{n}</span>
				<span class="h-3 bg-navy-500" style="width: var(--space-{n})"></span>
			</div>
		{/each}
	</div>
	<div class="flex flex-col gap-6">
		<div>
			<h3 class="mb-3 text-xl font-semibold">Radius</h3>
			<div class="flex gap-4">
				{#each radii as r (r)}
					<div
						class="flex h-16 w-16 items-center justify-center bg-navy-100 text-xs"
						style="border-radius: var(--radius-{r})"
					>
						{r}
					</div>
				{/each}
			</div>
		</div>
		<div>
			<h3 class="mb-3 text-xl font-semibold">Shadow</h3>
			<div class="flex gap-6">
				{#each shadows as s (s)}
					<div
						class="flex h-16 w-24 items-center justify-center rounded-md bg-surface text-xs"
						style="box-shadow: var(--shadow-{s})"
					>
						{s}
					</div>
				{/each}
			</div>
		</div>
		<div>
			<h3 class="mb-3 text-xl font-semibold">Motion (hover)</h3>
			<div class="flex gap-4">
				{#each durations as d (d)}
					<div
						class="flex h-16 w-24 items-center justify-center rounded-md bg-surface text-xs shadow-sm transition-transform ease-brand hover:-translate-y-1"
						style="transition-duration: var(--dur-{d})"
					>
						{d}
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>
