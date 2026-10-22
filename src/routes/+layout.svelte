<script lang="ts">
	import '../app.css';
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
	<link
		rel="preload"
		href="/fonts/apu-sans/apu-sans-400.woff2"
		as="font"
		type="font/woff2"
		crossorigin="anonymous"
	/>
</svelte:head>

{@render children()}
