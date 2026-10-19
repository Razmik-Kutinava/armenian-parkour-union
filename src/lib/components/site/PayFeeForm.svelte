<script lang="ts">
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import { enhance } from '$app/forms';
	import Button from '#lib/components/ui/Button.svelte';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';

	/* docs/06 section 9: the reason of a failed start and the button to try again. No amount field. */
	let { label, error }: { label: MessageKey; error?: MessageKey | null } = $props();
	let submitting = $state(false);
</script>

<form
	method="POST"
	action="?/pay"
	class="flex flex-col gap-3"
	use:enhance={() => {
		submitting = true;
		return async ({ result, update }) => {
			/* The provider page is usually on another site: client-side navigation cannot open it. */
			if (result.type === 'redirect') {
				window.location.assign(result.location);
				return;
			}
			await update();
			submitting = false;
		};
	}}
>
	{#if error}
		<p role="alert" class="flex items-start gap-2 rounded-md bg-error-bg p-3 text-sm text-error-fg">
			<CircleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
			{t(error)}
		</p>
	{/if}
	<Button type="submit" loading={submitting} class="self-start">{t(label)}</Button>
</form>
