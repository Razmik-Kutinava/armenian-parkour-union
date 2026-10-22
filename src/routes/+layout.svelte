<script lang="ts">
	import '../app.css';
	import { currentLocale } from '#lib/i18n/index.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	/* SSR sets <html lang> in hooks.server.ts; this keeps it right after client-side navigation. */
	$effect(() => {
		document.documentElement.lang = currentLocale();
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
