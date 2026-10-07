<script lang="ts">
	import { samples } from './data';
	import HeroPreview from './HeroPreview.svelte';
	import Swatches from './Swatches.svelte';
	import TypeSamples from './TypeSamples.svelte';
	import Ornaments from './Ornaments.svelte';
	import Scales from './Scales.svelte';

	let heroLang = $state(0);
</script>

<svelte:head>
	<title>Design tokens — dev</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div id="top" class="min-h-screen bg-bg font-body text-ink-900">
	<header
		class="sticky top-0 z-10 flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-line bg-surface/95 px-6 py-3 text-sm backdrop-blur"
	>
		<b class="text-navy-700">/dev/design</b>
		<fieldset class="flex gap-3">
			<legend class="sr-only">Hero language</legend>
			<span class="text-ink-500">Hero:</span>
			{#each samples as s, i (s.lang)}
				<label class="flex items-center gap-1">
					<input type="radio" bind:group={heroLang} value={i} />{s.lang}
				</label>
			{/each}
		</fieldset>
	</header>

	<HeroPreview sample={samples[heroLang]} />

	<main class="mx-auto flex max-w-page flex-col gap-16 px-4 py-12 md:px-8">
		<section>
			<h2 class="mb-6 text-3xl font-bold">Typography — APU Sans (Arian AMU)</h2>
			<TypeSamples {samples} />
		</section>
		<section>
			<h2 class="mb-6 text-3xl font-bold">Ornament</h2>
			<Ornaments />
		</section>
		<section>
			<h2 class="mb-6 text-3xl font-bold">Colours</h2>
			<Swatches />
		</section>
		<section>
			<h2 class="mb-6 text-3xl font-bold">Spacing, radius, shadow, motion</h2>
			<Scales />
		</section>
	</main>
</div>
