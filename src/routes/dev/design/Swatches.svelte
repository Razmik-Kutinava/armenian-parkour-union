<script lang="ts">
	import type { AccentPalette } from '#lib/design/palettes.ts';

	let { palette }: { palette: AccentPalette } = $props();

	const fixed = [
		{
			title: 'Navy (brand)',
			tokens: [
				'navy-950',
				'navy-900',
				'navy-800',
				'navy-700',
				'navy-600',
				'navy-500',
				'navy-300',
				'navy-100',
				'navy-50'
			]
		},
		{ title: 'Neutral', tokens: ['ink-900', 'ink-700', 'ink-500', 'line', 'surface', 'bg'] },
		{
			title: 'Semantic',
			tokens: [
				'success-bg',
				'success-fg',
				'warning-bg',
				'warning-fg',
				'error-bg',
				'error-fg',
				'error-strong',
				'info-bg',
				'info-fg'
			]
		}
	];
	const accent = $derived([
		['accent-500', palette.accent500],
		['accent-600', palette.accent600],
		['accent-700', palette.accent700],
		['accent-100', palette.accent100]
	]);
</script>

<div class="flex flex-col gap-8">
	<div>
		<h3 class="mb-3 text-xl font-semibold">
			Accent — {palette.name}
			<span class="text-sm font-normal text-ink-500">({palette.source})</span>
		</h3>
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
			{#each accent as [token, hex] (token)}
				<div class="overflow-hidden rounded-md border border-line bg-surface">
					<div class="h-16" style="background: var(--{token})"></div>
					<p class="px-3 py-2 text-sm"><b>--{token}</b> <span class="text-ink-500">{hex}</span></p>
				</div>
			{/each}
		</div>
	</div>
	{#each fixed as group (group.title)}
		<div>
			<h3 class="mb-3 text-xl font-semibold">{group.title}</h3>
			<div class="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
				{#each group.tokens as token (token)}
					<div class="overflow-hidden rounded-md border border-line bg-surface">
						<div class="h-12" style="background: var(--{token})"></div>
						<p class="px-2 py-1 text-xs">--{token}</p>
					</div>
				{/each}
			</div>
		</div>
	{/each}
</div>
