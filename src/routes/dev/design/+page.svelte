<script lang="ts">
	import './candidates.css';
	import { accentPalettes } from '#lib/design/palettes.ts';
	import type { OrnamentVariant } from '#lib/components/Ornament.svelte';
	import { fontSets, samples } from './data';
	import HeroPreview from './HeroPreview.svelte';
	import Swatches from './Swatches.svelte';
	import TypeSamples from './TypeSamples.svelte';
	import Ornaments from './Ornaments.svelte';
	import Scales from './Scales.svelte';

	let paletteId = $state(accentPalettes[0].id);
	let fontId = $state(fontSets[0].id);
	let ornament: OrnamentVariant = $state('rhombus');
	let heroLang = $state(0);

	const palette = $derived(accentPalettes.find((p) => p.id === paletteId) ?? accentPalettes[0]);
	const font = $derived(fontSets.find((f) => f.id === fontId) ?? fontSets[0]);
	const vars = $derived(
		`--accent-500:${palette.accent500};--accent-600:${palette.accent600};` +
			`--accent-700:${palette.accent700};--accent-100:${palette.accent100};` +
			`--font-display:${font.display};--font-body:${font.body}`
	);
</script>

<svelte:head>
	<title>Design tokens — dev</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div id="top" class="min-h-screen bg-bg font-body text-ink-900" style={vars}>
	<header
		class="sticky top-0 z-10 flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-line bg-surface/95 px-6 py-3 text-sm backdrop-blur"
	>
		<b class="text-navy-700">/dev/design</b>
		<fieldset class="flex flex-wrap gap-3">
			<legend class="sr-only">Accent</legend>
			<span class="text-ink-500">Accent:</span>
			{#each accentPalettes as p (p.id)}
				<label class="flex items-center gap-1">
					<input type="radio" bind:group={paletteId} value={p.id} />
					<span class="inline-block h-3 w-3 rounded-full" style="background:{p.accent500}"
					></span>{p.name}
				</label>
			{/each}
		</fieldset>
		<fieldset class="flex flex-wrap gap-3">
			<legend class="sr-only">Fonts</legend>
			<span class="text-ink-500">Fonts:</span>
			{#each fontSets as f (f.id)}
				<label class="flex items-center gap-1"
					><input type="radio" bind:group={fontId} value={f.id} />{f.name}</label
				>
			{/each}
		</fieldset>
		<fieldset class="flex gap-3">
			<legend class="sr-only">Hero language</legend>
			<span class="text-ink-500">Hero:</span>
			{#each samples as s, i (s.lang)}
				<label class="flex items-center gap-1"
					><input type="radio" bind:group={heroLang} value={i} />{s.lang}</label
				>
			{/each}
		</fieldset>
	</header>

	<HeroPreview sample={samples[heroLang]} {ornament} />

	<main class="mx-auto flex max-w-page flex-col gap-16 px-4 py-12 md:px-8">
		<section>
			<h2 class="mb-2 text-3xl font-bold">Typography — {font.name}</h2>
			<p class="mb-6 text-sm text-ink-500">{font.note}</p>
			<TypeSamples {samples} />
		</section>
		<section>
			<h2 class="mb-6 text-3xl font-bold">Ornament</h2>
			<Ornaments bind:selected={ornament} />
		</section>
		<section>
			<h2 class="mb-6 text-3xl font-bold">Colours</h2>
			<Swatches {palette} />
		</section>
		<section>
			<h2 class="mb-6 text-3xl font-bold">Spacing, radius, shadow, motion</h2>
			<Scales />
		</section>
	</main>
</div>
