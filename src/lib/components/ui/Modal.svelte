<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';

	let {
		open = $bindable(false),
		title,
		closeLabel,
		children,
		footer
	}: {
		open?: boolean;
		title: string;
		closeLabel?: string;
		children: Snippet;
		footer?: Snippet;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	const id = $props.id();
	const titleId = `${id}-title`;
	const close = $derived(closeLabel ?? t('common.close'));

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});
</script>

<!-- Native <dialog>: Esc closes, focus is trapped, page behind is inert. -->
<dialog
	bind:this={dialog}
	aria-labelledby={titleId}
	onclose={() => (open = false)}
	onclick={(e) => e.target === dialog && dialog?.close()}
	class="m-0 mt-auto w-full max-w-none rounded-t-lg bg-surface p-0 text-ink-900 shadow-lg backdrop:bg-navy-950/60 sm:m-auto sm:max-w-lg sm:rounded-lg"
>
	<div class="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
		<h2 id={titleId} class="text-xl font-bold">{title}</h2>
		<button
			type="button"
			class="-m-2 rounded-sm p-2 text-ink-500 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-navy-600"
			aria-label={close}
			onclick={() => dialog?.close()}
		>
			<X class="size-5" aria-hidden="true" />
		</button>
	</div>
	<div class="px-6 py-4">{@render children()}</div>
	{#if footer}
		<div class="flex flex-wrap justify-end gap-3 border-t border-line px-6 py-4">
			{@render footer()}
		</div>
	{/if}
</dialog>
