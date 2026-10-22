<script lang="ts">
	/* docs/08: avatars 1:1, fully rounded; no photo — initials of the name. */
	type Props = { name: string; url: string | null; alt?: string; class?: string };
	let { name, url, alt = '', class: size = 'size-14 text-lg' }: Props = $props();

	const initials = $derived(
		name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0]?.toUpperCase())
			.join('')
	);
</script>

{#if url}
	<img src={url} {alt} class="{size} shrink-0 rounded-full bg-navy-100 object-cover" />
{:else}
	<span
		class="{size} flex shrink-0 items-center justify-center rounded-full bg-navy-900 font-bold text-surface"
		aria-hidden="true">{initials}</span
	>
{/if}
