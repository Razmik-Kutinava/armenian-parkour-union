<script lang="ts">
	import NewsArticle from '#lib/components/site/NewsArticle.svelte';
	import SeoHead from '#lib/components/site/SeoHead.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<SeoHead seo={data.seo} />
<NewsArticle post={data.post} related={data.related} shareUrl={data.seo.canonical} />
