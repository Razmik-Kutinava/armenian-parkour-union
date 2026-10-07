<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import AdminSidebar from '#lib/components/admin/AdminSidebar.svelte';
	import AdminTopbar from '#lib/components/admin/AdminTopbar.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
	let menuOpen = $state(false);

	afterNavigate(() => {
		menuOpen = false;
	});
</script>

<svelte:head><meta name="robots" content="noindex" /></svelte:head>

<a
	href="#content"
	class="sr-only z-50 rounded-md bg-accent-500 px-4 py-2 font-bold text-navy-950 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
>
	{t('nav.skip')}
</a>

<div class="flex min-h-screen bg-bg">
	<AdminSidebar nav={data.nav} open={menuOpen} />
	{#if menuOpen}
		<button
			type="button"
			class="fixed inset-0 z-30 bg-navy-950/60 lg:hidden"
			aria-label={t('common.close')}
			onclick={() => (menuOpen = false)}
		></button>
	{/if}
	<div class="flex min-w-0 flex-1 flex-col">
		<AdminTopbar staff={data.staff} nav={data.nav} bind:menuOpen />
		<main id="content" class="flex-1 px-4 py-6 lg:px-8" tabindex="-1">
			{@render children()}
		</main>
	</div>
</div>
