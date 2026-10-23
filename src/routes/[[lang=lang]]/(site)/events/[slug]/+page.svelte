<script lang="ts">
	import EventArticle from '#lib/components/site/EventArticle.svelte';
	import SeoHead from '#lib/components/site/SeoHead.svelte';
	import RegistrationBlock from './RegistrationBlock.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<SeoHead seo={data.seo} />
<EventArticle event={data.event} shareUrl={data.seo.canonical}>
	{#snippet registration()}
		<RegistrationBlock
			view={data.registration}
			paid={data.event.priceAmountMinor > 0}
			notice={form?.registration}
			payError={form?.payError}
		/>
	{/snippet}
</EventArticle>
