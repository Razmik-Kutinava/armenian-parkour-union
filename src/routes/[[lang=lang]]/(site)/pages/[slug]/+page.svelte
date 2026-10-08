<script lang="ts">
	import ContentPage from '#lib/components/site/ContentPage.svelte';
	import ContactDetails from '#lib/components/site/ContactDetails.svelte';
	import type { PageProps } from './$types';

	/* docs/06 section 4.5: "Contacts" also shows the contacts and socials from site settings. */
	let { data }: PageProps = $props();
</script>

<ContentPage page={data.page}>
	{#if data.page.slug === 'contacts'}
		<ContactDetails footer={data.footer} />
	{/if}
</ContentPage>
