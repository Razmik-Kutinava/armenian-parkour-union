<script lang="ts">
	import SiteFooter from '#lib/components/site/SiteFooter.svelte';
	import SiteHeader from '#lib/components/site/SiteHeader.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<a
	href="#content"
	class="sr-only z-50 rounded-md bg-accent-500 px-4 py-2 font-bold text-navy-950 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
>
	{t('nav.skip')}
</a>

<div class="flex min-h-screen flex-col bg-bg">
	<SiteHeader viewer={data.viewer} />
	<main id="content" class="flex-1" tabindex="-1">
		{@render children()}
	</main>
	<SiteFooter footer={data.footer} />
</div>
