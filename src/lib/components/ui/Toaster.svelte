<script lang="ts">
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Info from '@lucide/svelte/icons/info';
	import X from '@lucide/svelte/icons/x';
	import { dismissToast, toasts, type ToastTone } from './toast.svelte';

	/** Accessible name of the close button, from translations. */
	let { closeLabel }: { closeLabel: string } = $props();

	const tones: Record<ToastTone, { icon: typeof Info; class: string }> = {
		success: { icon: CircleCheck, class: 'text-success-fg' },
		error: { icon: CircleAlert, class: 'text-error-fg' },
		info: { icon: Info, class: 'text-info-fg' }
	};
</script>

<div
	class="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-3 sm:left-auto sm:w-96"
	role="status"
	aria-live="polite"
>
	{#each toasts as toast (toast.id)}
		{@const tone = tones[toast.tone]}
		<div
			class="pointer-events-auto flex w-full items-start gap-3 rounded-md border border-line bg-surface p-4 shadow-md"
			role={toast.tone === 'error' ? 'alert' : undefined}
		>
			<tone.icon class="mt-0.5 size-5 shrink-0 {tone.class}" aria-hidden="true" />
			<p class="flex-1 text-sm text-ink-900">{toast.message}</p>
			<button
				type="button"
				class="-m-1 rounded-sm p-1 text-ink-500 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-navy-600"
				aria-label={closeLabel}
				onclick={() => dismissToast(toast.id)}
			>
				<X class="size-4" aria-hidden="true" />
			</button>
		</div>
	{/each}
</div>
