<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';

	type Props = Omit<HTMLInputAttributes, 'type'> & {
		/** Plain label or a snippet (e.g. text with a link to the policy). */
		label: string | Snippet;
		error?: string;
	};

	let {
		label,
		error,
		checked = $bindable(false),
		class: className = '',
		...rest
	}: Props = $props();
	const id = $props.id();
	const errorId = `${id}-error`;
</script>

<div class="flex flex-col {className}">
	<label
		class="flex min-h-11 cursor-pointer items-center gap-3 text-base text-ink-900 has-disabled:cursor-not-allowed has-disabled:text-ink-500"
	>
		<input
			type="checkbox"
			bind:checked
			aria-invalid={!!error || undefined}
			aria-describedby={error ? errorId : undefined}
			class="size-5 shrink-0 cursor-pointer rounded-sm accent-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 disabled:cursor-not-allowed"
			{...rest}
		/>
		{#if typeof label === 'string'}{label}{:else}{@render label()}{/if}
	</label>
	{#if error}
		<p id={errorId} class="pl-8 text-sm text-error-fg">{error}</p>
	{/if}
</div>
