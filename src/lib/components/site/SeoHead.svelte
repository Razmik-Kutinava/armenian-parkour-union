<script lang="ts">
	import type { Seo } from '#lib/seo/meta.ts';

	/* docs/06 section 7: what messengers and search engines read. jsonLd has `<` escaped. */
	let { seo }: { seo: Seo } = $props();
	const close = '</' + 'script>';
	const ld = $derived(seo.jsonLd ? `<script type="application/ld+json">${seo.jsonLd}${close}` : '');
</script>

<svelte:head>
	<title>{seo.title}</title>
	<meta name="description" content={seo.description} />
	<link rel="canonical" href={seo.canonical} />
	{#each seo.tags as tag, i (i)}
		{#if tag.property}
			<meta property={tag.property} content={tag.content} />
		{:else}
			<meta name={tag.name} content={tag.content} />
		{/if}
	{/each}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html ld}
</svelte:head>
