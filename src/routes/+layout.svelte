<script lang="ts">
	import '../app.css';
	import bold from '#lib/assets/fonts/apu-sans/apu-sans-700.woff2';
	import regular from '#lib/assets/fonts/apu-sans/apu-sans-400.woff2';
	import { currentLocale } from '#lib/i18n/index.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	/* SSR sets <html lang> in hooks.server.ts; this keeps it right after client-side navigation. */
	$effect(() => {
		document.documentElement.lang = currentLocale();
	});
	/* e2e waits for this mark: input typed before hydration is overwritten or half-applied. */
	$effect(() => {
		document.documentElement.dataset.hydrated = '';
	});
</script>

<svelte:head>
	<link rel="icon" href="/brand/favicon.svg" type="image/svg+xml" />
	<!-- docs/08 § 4.2: body text and headings; the same hashed files as in app.css. -->
	{#each [regular, bold] as font (font)}
		<link rel="preload" href={font} as="font" type="font/woff2" crossorigin="anonymous" />
	{/each}
</svelte:head>

{@render children()}
