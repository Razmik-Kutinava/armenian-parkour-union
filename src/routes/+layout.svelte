<script lang="ts">
	import '../app.css';
	import bold from '#lib/assets/fonts/apu-sans/apu-sans-700.woff2';
	import regular from '#lib/assets/fonts/apu-sans/apu-sans-400.woff2';
	import { onNavigate } from '$app/navigation';
	import { updated } from '$app/state';
	import { currentLocale } from '#lib/i18n/index.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	/* A tab opened before a deploy knows only the old routes: rendering new data into them breaks
	 * the layout. The navigation never finishes; the browser loads the page in full instead. */
	onNavigate(({ to, type, willUnload }) => {
		if (!updated.current || willUnload || !to) return;
		if (type === 'popstate') location.reload();
		else location.href = to.url.href;
		return new Promise<never>(() => {});
	});

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
