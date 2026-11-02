<script lang="ts">
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';

	/* docs/05 section 28: a new link unbinds the phone; disable is final — both ask first. */
	let { cashier }: { cashier: { id: string; label: string } } = $props();
	let relink = $state(false);
	let disable = $state(false);
</script>

<div class="flex flex-wrap justify-end gap-2">
	<Button variant="ghost" size="sm" onclick={() => (relink = true)}
		>{t('volunteer.cashiers.relink')}</Button
	>
	<Button variant="ghost" size="sm" onclick={() => (disable = true)}
		>{t('volunteer.cashiers.disable')}</Button
	>
</div>
<ConfirmDialog
	bind:open={relink}
	title={t('volunteer.cashiers.relink')}
	text={t('volunteer.cashiers.relinkText', { label: cashier.label })}
	action="?/link"
	confirmLabel={t('volunteer.cashiers.relink')}
>
	{#snippet fields()}<input type="hidden" name="cashierId" value={cashier.id} />{/snippet}
</ConfirmDialog>
<ConfirmDialog
	bind:open={disable}
	title={t('volunteer.cashiers.disable')}
	text={t('volunteer.cashiers.disableText', { label: cashier.label })}
	action="?/disable"
	confirmLabel={t('volunteer.cashiers.disable')}
	danger
>
	{#snippet fields()}<input type="hidden" name="cashierId" value={cashier.id} />{/snippet}
</ConfirmDialog>
