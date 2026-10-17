<script lang="ts">
	import ContentPage from '#lib/components/site/ContentPage.svelte';
	import SeoHead from '#lib/components/site/SeoHead.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<SeoHead seo={data.seo} />
<ContentPage page={data.page} />
