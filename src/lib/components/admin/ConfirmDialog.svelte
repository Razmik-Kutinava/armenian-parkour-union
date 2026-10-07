<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Modal from '#lib/components/ui/Modal.svelte';
	import { controlClass } from '#lib/components/ui/control.ts';
	import { t } from '#lib/i18n/index.svelte.ts';

	/* docs/05 section 1 item 7, docs/08 section 8.1: consequences in the text, the button in the action
	 * colour, a comment where required. The server re-checks the right and the comment. */
	let {
		open = $bindable(false),
		title,
		text,
		action,
		confirmLabel,
		danger = false,
		comment = 'none',
		fields
	}: {
		open?: boolean;
		title: string;
		text: string;
		action: string;
		confirmLabel: string;
		danger?: boolean;
		comment?: 'none' | 'optional' | 'required';
		fields?: Snippet;
	} = $props();

	const id = $props.id();
</script>

<Modal bind:open {title}>
	<form id="{id}-form" method="POST" {action} class="flex flex-col gap-4">
		<p class="text-ink-700">{text}</p>
		{#if fields}{@render fields()}{/if}
		{#if comment !== 'none'}
			<label class="flex flex-col gap-1 text-sm font-bold text-ink-900">
				{t(comment === 'required' ? 'confirm.commentRequired' : 'confirm.comment')}
				<textarea
					name="comment"
					required={comment === 'required'}
					maxlength="1000"
					rows="3"
					class="{controlClass} h-auto px-3 py-2 font-normal"></textarea>
			</label>
		{/if}
	</form>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (open = false)}>{t('form.cancel')}</Button>
		<Button type="submit" form="{id}-form" variant={danger ? 'danger' : 'primary'}
			>{confirmLabel}</Button
		>
	{/snippet}
</Modal>
