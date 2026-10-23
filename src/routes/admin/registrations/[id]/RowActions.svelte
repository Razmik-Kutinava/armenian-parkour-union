<script lang="ts">
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';

	/* docs/05 section 5: move from the waitlist; cancel with a reason. The server decides. */
	let { id, status }: { id: string; status: string } = $props();
	const cancellable = $derived(['registered', 'pending_payment', 'waitlist'].includes(status));
	let promoteOpen = $state(false);
	let cancelOpen = $state(false);
</script>

{#snippet target()}<input type="hidden" name="registrationId" value={id} />{/snippet}

<div class="flex flex-wrap gap-2">
	{#if status === 'waitlist'}
		<Button size="sm" variant="secondary" onclick={() => (promoteOpen = true)}
			>{t('registrationsAdmin.promote')}</Button
		>
	{/if}
	{#if cancellable}
		<Button size="sm" variant="ghost" onclick={() => (cancelOpen = true)}
			>{t('registrationsAdmin.cancel')}</Button
		>
	{/if}
</div>

<ConfirmDialog
	bind:open={promoteOpen}
	title={t('registrationsAdmin.promoteTitle')}
	text={t('registrationsAdmin.promoteText')}
	action="?/promote"
	confirmLabel={t('registrationsAdmin.promote')}
	fields={target}
/>
<ConfirmDialog
	bind:open={cancelOpen}
	title={t('registrationsAdmin.cancelTitle')}
	text={t('registrationsAdmin.cancelText')}
	action="?/cancel"
	confirmLabel={t('registrationsAdmin.cancel')}
	comment="required"
	danger
	fields={target}
/>
