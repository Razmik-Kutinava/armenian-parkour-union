<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import Button from '#lib/components/ui/Button.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { OwnEvent } from '#lib/server/services/cabinet/events.ts';

	/* docs/06 section 5.4: "Pay" and "Cancel" by the conditions; the server checks them again. */
	let { event }: { event: OwnEvent } = $props();
	let submitting = $state<'pay' | 'cancel' | null>(null);

	const submit =
		(action: 'pay' | 'cancel'): SubmitFunction =>
		() => {
			submitting = action;
			return async ({ result, update }) => {
				/* The provider page is usually on another site: client-side navigation cannot open it. */
				if (result.type === 'redirect' && action === 'pay') {
					window.location.assign(result.location);
					return;
				}
				await update();
				submitting = null;
			};
		};
</script>

<div class="flex flex-wrap gap-2">
	{#if event.canPay}
		<form method="POST" action="?/pay" use:enhance={submit('pay')}>
			<input type="hidden" name="eventId" value={event.eventId} />
			<Button type="submit" loading={submitting === 'pay'}>{t('registrations.pay')}</Button>
		</form>
	{/if}
	{#if event.cancelUntil}
		<form method="POST" action="?/cancel" use:enhance={submit('cancel')}>
			<input type="hidden" name="eventId" value={event.eventId} />
			<Button type="submit" variant="secondary" loading={submitting === 'cancel'}>
				{t(event.status === 'waitlist' ? 'registrations.leaveWaitlist' : 'registrations.cancel')}
			</Button>
		</form>
	{/if}
</div>
