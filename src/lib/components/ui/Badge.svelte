<script lang="ts">
	import type { Snippet } from 'svelte';

	type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'accent';

	let { tone = 'neutral', children }: { tone?: Tone; children: Snippet } = $props();

	const tones: Record<Tone, string> = {
		success: 'bg-success-bg text-success-fg',
		warning: 'bg-warning-bg text-warning-fg',
		error: 'bg-error-bg text-error-fg',
		info: 'bg-info-bg text-info-fg',
		neutral: 'bg-line text-ink-700',
		accent: 'bg-accent-100 text-navy-950'
	};
</script>

<span
	class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-bold whitespace-nowrap {tones[
		tone
	]}"
>
	{@render children()}
</span>
