<script lang="ts">
	import ContentPage from '#lib/components/site/ContentPage.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<ContentPage page={data.page} />
