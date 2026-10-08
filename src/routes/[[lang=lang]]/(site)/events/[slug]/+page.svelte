<script lang="ts">
	import EventArticle from '#lib/components/site/EventArticle.svelte';
	import SeoHead from '#lib/components/site/SeoHead.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<SeoHead seo={data.seo} />
<EventArticle event={data.event} shareUrl={data.seo.canonical} />
