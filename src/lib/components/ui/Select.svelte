<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import type { HTMLSelectAttributes } from 'svelte/elements';
	import Field from './Field.svelte';
	import { controlClass } from './control';

	type Option = { value: string; label: string; disabled?: boolean };
	type Props = Omit<HTMLSelectAttributes, 'id'> & {
		label: string;
		options: Option[];
		placeholder?: string;
		hint?: string;
		error?: string;
	};

	let {
		label,
		options,
		placeholder,
		hint,
		error,
		value = $bindable(),
		class: className = '',
		...rest
	}: Props = $props();

	/* Svelte keeps an <input> edited before hydration, not a <select>: it resets it to the state.
	 * Runs before the bind:value effect; `selected` attributes exist only in server markup. */
	function keepEarlyChoice(select: HTMLSelectElement) {
		const initial = [...select.options].find((option) => option.defaultSelected);
		if (initial && !initial.selected) value = select.value;
	}
</script>

<Field {label} {hint} {error}>
	{#snippet control({ id, describedBy, invalid })}
		<div class="relative">
			<select
				{id}
				bind:value
				{@attach keepEarlyChoice}
				aria-describedby={describedBy}
				aria-invalid={invalid || undefined}
				class="{controlClass} appearance-none pr-10 pl-3 {className}"
				{...rest}
			>
				{#if placeholder}
					<option value="" disabled>{placeholder}</option>
				{/if}
				{#each options as option (option.value)}
					<option value={option.value} disabled={option.disabled}>{option.label}</option>
				{/each}
			</select>
			<ChevronDown
				class="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-ink-500"
				aria-hidden="true"
			/>
		</div>
	{/snippet}
</Field>
