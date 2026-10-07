<script lang="ts">
	import '@fontsource/inter/400.css';
	import '@fontsource/inter/500.css';
	import '@fontsource/inter/600.css';
	import '@fontsource/inter/700.css';
	import '@fontsource/unbounded/600.css';
	import '@fontsource/unbounded/700.css';
	import '@fontsource/noto-sans-armenian/400.css';
	import '@fontsource/noto-sans-armenian/600.css';
	import '@fontsource/noto-sans-armenian/700.css';
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
