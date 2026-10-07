<script lang="ts">
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';

	let { user }: { user: { id: string; name: string } } = $props();
	let open = $state(false);
</script>

<Button variant="ghost" onclick={() => (open = true)}>{t('roles.revoke')}</Button>
<ConfirmDialog
	bind:open
	title={t('roles.revoke')}
	text={t('roles.revokeText', { name: user.name })}
	action="?/revoke"
	confirmLabel={t('roles.revoke')}
	danger
>
	{#snippet fields()}<input type="hidden" name="userId" value={user.id} />{/snippet}
</ConfirmDialog>
