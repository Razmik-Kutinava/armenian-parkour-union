<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '#lib/components/ui/Button.svelte';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';

	/* docs/03 section 7.5: the member cancels their own registration or leaves the line. */
	let { label }: { label: MessageKey } = $props();
	let submitting = $state(false);
</script>

<form
	method="POST"
	action="?/cancel"
	use:enhance={() => {
		submitting = true;
		return async ({ update }) => {
			await update();
			submitting = false;
		};
	}}
>
	<Button type="submit" variant="secondary" loading={submitting}>{t(label)}</Button>
</form>
