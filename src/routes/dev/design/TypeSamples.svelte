<script lang="ts">
	import type { Sample } from './data';

	let { samples }: { samples: Sample[] } = $props();
</script>

<div class="grid gap-6 lg:grid-cols-3">
	{#each samples as s (s.lang)}
		<article lang={s.lang} class="flex flex-col gap-3 rounded-md bg-surface p-6 shadow-sm">
			<p class="text-xs font-semibold text-ink-500">{s.lang.toUpperCase()}</p>
			<h1 class="text-4xl font-bold text-navy-700">{s.title}</h1>
			<h2 class="text-3xl font-bold">{s.subtitle}</h2>
			<h3 class="text-2xl font-semibold">{s.secondary}</h3>
			<p class="text-lg">{s.body}</p>
			<p class="text-base">{s.body}</p>
			<p class="text-sm text-ink-700">{s.body}</p>
			<p class="text-sm">
				<a href="#top" class="font-medium text-accent-700 underline">{s.secondary}</a>
			</p>
			<div class="flex flex-wrap gap-3 pt-2">
				<button
					class="rounded-md bg-navy-700 px-5 py-3 font-semibold text-surface hover:bg-navy-600"
				>
					{s.action}
				</button>
				<span class="rounded-full bg-accent-100 px-3 py-1 text-sm font-medium text-navy-950">
					{s.secondary}
				</span>
			</div>
		</article>
	{/each}
</div>
