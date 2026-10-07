<script lang="ts">
	import Ornament, { type OrnamentVariant } from '#lib/components/Ornament.svelte';
	import type { Sample } from './data';

	let { sample, ornament }: { sample: Sample; ornament: OrnamentVariant } = $props();
</script>

<section
	lang={sample.lang}
	class="relative overflow-hidden bg-navy-950 px-6 pt-16 pb-24 text-surface md:px-12"
	style="clip-path: polygon(0 0, 100% 0, 100% 88%, 0 100%)"
>
	<Ornament variant={ornament} class="absolute inset-0 text-navy-300 opacity-10" />
	<div class="relative mx-auto flex max-w-page flex-col gap-6">
		<p class="text-sm font-semibold text-accent-500">parkour.am</p>
		<h1 class="max-w-3xl text-4xl font-bold md:text-5xl">{sample.title}</h1>
		<p class="max-w-2xl text-lg text-navy-100">{sample.subtitle}</p>
		<div class="flex flex-wrap gap-4">
			<button
				class="rounded-md bg-accent-500 px-6 py-3 font-semibold text-navy-950 transition-colors duration-(--dur-fast) hover:bg-accent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
			>
				{sample.action}
			</button>
			<button
				class="rounded-md border border-navy-300 px-6 py-3 font-semibold text-navy-300 transition-colors duration-(--dur-fast) hover:bg-navy-800"
			>
				{sample.secondary}
			</button>
		</div>
	</div>
</section>
