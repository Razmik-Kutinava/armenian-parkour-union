<script lang="ts">
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import CircleCheck from '@lucide/svelte/icons/circle-check';

	let { tone, text }: { tone: 'error' | 'success'; text: string } = $props();
	const Icon = $derived(tone === 'error' ? CircleAlert : CircleCheck);
</script>

<p
	role={tone === 'error' ? 'alert' : 'status'}
	class="flex items-start gap-2 rounded-md p-3 text-sm {tone === 'error'
		? 'bg-error-bg text-error-fg'
		: 'bg-success-bg text-success-fg'}"
>
	<Icon class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
	{text}
</p>
