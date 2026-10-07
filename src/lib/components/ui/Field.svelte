<script lang="ts" module>
	export interface FieldControl {
		id: string;
		describedBy: string | undefined;
		invalid: boolean;
	}
</script>

<script lang="ts">
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import type { Snippet } from 'svelte';

	let {
		label,
		hint,
		error,
		control
	}: { label: string; hint?: string; error?: string; control: Snippet<[FieldControl]> } = $props();

	const id = $props.id();
	const hintId = `${id}-hint`;
	const errorId = `${id}-error`;
	const describedBy = $derived(
		[hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined
	);
</script>

<div class="flex flex-col gap-1">
	<label for={id} class="text-sm font-bold text-ink-900">{label}</label>
	{@render control({ id, describedBy, invalid: !!error })}
	{#if hint}
		<p id={hintId} class="text-sm text-ink-500">{hint}</p>
	{/if}
	{#if error}
		<p id={errorId} class="flex items-center gap-1 text-sm text-error-fg">
			<CircleAlert class="size-4 shrink-0" aria-hidden="true" />{error}
		</p>
	{/if}
</div>
