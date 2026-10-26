<script lang="ts">
	import { currentLocale, localizePath, t, type MessageKey } from '#lib/i18n/index.svelte.ts';

	type LegalPage = 'privacy' | 'rules' | 'offer' | 'refund-policy';

	/* Opened in a new tab: the form the visitor is filling in stays as it is. */
	let { lead, pages }: { lead: MessageKey; pages: LegalPage[] } = $props();

	const names: Record<LegalPage, MessageKey> = {
		privacy: 'footer.privacy',
		rules: 'footer.rules',
		offer: 'footer.offer',
		'refund-policy': 'footer.refund'
	};
</script>

<p class="text-sm text-ink-700">
	{t(lead)}
	{#each pages as slug, i (slug)}{#if i > 0},{/if}
		<a
			class="text-navy-700 underline hover:text-navy-900"
			href={localizePath(`/pages/${slug}`, currentLocale())}
			target="_blank"
			rel="noopener">{t(names[slug])}</a
		>{/each}
</p>
