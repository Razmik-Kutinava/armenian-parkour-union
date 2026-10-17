<script lang="ts">
	import FestAnnouncement from '#lib/components/site/FestAnnouncement.svelte';
	import SeoHead from '#lib/components/site/SeoHead.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<SeoHead seo={data.seo} />
<FestAnnouncement />
