<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import Field from './Field.svelte';
	import { controlClass } from './control';

	type Props = Omit<HTMLInputAttributes, 'id'> & { label: string; hint?: string; error?: string };

	let { label, hint, error, value = $bindable(), class: className = '', ...rest }: Props = $props();
</script>

<Field {label} {hint} {error}>
	{#snippet control({ id, describedBy, invalid })}
		<input
			{id}
			bind:value
			aria-describedby={describedBy}
			aria-invalid={invalid || undefined}
			class="{controlClass} px-3 {className}"
			{...rest}
		/>
	{/snippet}
</Field>
