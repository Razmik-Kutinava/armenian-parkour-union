<script lang="ts">
	import type { Snippet } from 'svelte';
	import { currentLocale } from '#lib/i18n/index.svelte.ts';
	import { localizePath } from '#lib/i18n/locales.ts';

	/* One home page section: heading, optional "all" link, content (docs/06 section 4.1). */
	type Props = { title: string; more?: { label: string; path: string }; children: Snippet };
	let { title, more, children }: Props = $props();
</script>

<section class="mx-auto flex w-full max-w-page flex-col gap-6 px-6 py-12 md:px-12">
	<div class="flex flex-wrap items-baseline justify-between gap-3">
		<h2 class="text-3xl font-bold text-navy-700">{title}</h2>
		{#if more}
			<a
				class="font-bold text-navy-700 underline-offset-2 hover:underline"
				href={localizePath(more.path, currentLocale())}>{more.label}</a
			>
		{/if}
	</div>
	{@render children()}
</section>
