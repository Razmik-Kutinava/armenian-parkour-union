<script lang="ts">
	const groups = [
		{ title: 'Accent (apricot)', tokens: ['accent-500', 'accent-600', 'accent-700', 'accent-100'] },
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
</script>

<div class="flex flex-col gap-8">
	{#each groups as group (group.title)}
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
