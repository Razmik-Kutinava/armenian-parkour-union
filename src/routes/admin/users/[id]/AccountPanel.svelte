<script lang="ts">
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import type { UserCard } from '#lib/server/services/users/card.ts';

	/* docs/05 section 6: account actions of an admin; dangerous ones go through ConfirmDialog. */
	type Props = {
		card: UserCard;
		can: { edit: boolean; role: boolean; block: boolean };
		isSelf: boolean;
	};
	let { card, can, isSelf }: Props = $props();

	const roles = ['member', 'editor', 'moderator', 'admin'] as const;
	let role = $derived<string>(card.role);
	let roleOpen = $state(false);
	let blockOpen = $state(false);
	let deleteOpen = $state(false);
	let declineOpen = $state(false);
</script>

<FormSection title={t('users.section.account')}>
	{#if card.email !== undefined}
		<div class="flex flex-wrap items-center gap-3">
			<span class="font-bold">{card.email}</span>
			<Badge tone={card.emailVerified ? 'success' : 'warning'}>
				{t(card.emailVerified ? 'users.emailVerified' : 'users.emailNotVerified')}
			</Badge>
		</div>
	{/if}
	{#if can.edit}
		<div class="flex flex-wrap gap-3">
			{#if !card.emailVerified}
				<form method="POST" action="?/confirmEmail">
					<Button type="submit" variant="secondary">{t('users.confirmEmail')}</Button>
				</form>
			{/if}
			<form method="POST" action="?/passwordLink">
				<Button type="submit" variant="secondary">{t('users.passwordLink')}</Button>
			</form>
		</div>
	{/if}

	{#if can.role && !isSelf}
		<div class="flex flex-wrap items-end gap-3">
			<div class="min-w-48">
				<Select
					label={t('users.col.role')}
					bind:value={role}
					options={roles.map((r) => ({ value: r, label: t(`role.${r}`) }))}
				/>
			</div>
			<Button variant="secondary" disabled={role === card.role} onclick={() => (roleOpen = true)}>
				{t('users.changeRole')}
			</Button>
		</div>
		<ConfirmDialog
			bind:open={roleOpen}
			title={t('users.changeRoleTitle')}
			text={t('users.changeRoleText', { role: t(`role.${role as (typeof roles)[number]}`) })}
			action="?/role"
			confirmLabel={t('users.changeRole')}
		>
			{#snippet fields()}<input type="hidden" name="role" value={role} />{/snippet}
		</ConfirmDialog>
	{/if}

	{#if can.block && !isSelf}
		<div>
			{#if card.status === 'active'}
				<Button variant="danger" onclick={() => (blockOpen = true)}>{t('users.block')}</Button>
			{:else}
				<Button variant="secondary" onclick={() => (blockOpen = true)}>{t('users.unblock')}</Button>
			{/if}
		</div>
		<ConfirmDialog
			bind:open={blockOpen}
			title={t(card.status === 'active' ? 'users.blockTitle' : 'users.unblockTitle')}
			text={t(card.status === 'active' ? 'users.blockText' : 'users.unblockText')}
			action={card.status === 'active' ? '?/block' : '?/unblock'}
			confirmLabel={t(card.status === 'active' ? 'users.block' : 'users.unblock')}
			danger={card.status === 'active'}
			comment={card.status === 'active' ? 'required' : 'none'}
		/>
	{/if}

	{#if card.deletionRequestedAt}
		<div class="flex flex-col gap-3">
			<Badge tone="warning">
				{t('users.deletion.asked', {
					date: card.deletionRequestedAt.toLocaleDateString(currentLocale())
				})}
			</Badge>
			{#if can.block && !isSelf}
				<div class="flex flex-wrap gap-3">
					<Button variant="danger" onclick={() => (deleteOpen = true)}>{t('users.delete')}</Button>
					<Button variant="secondary" onclick={() => (declineOpen = true)}>
						{t('users.declineDeletion')}
					</Button>
				</div>
				<ConfirmDialog
					bind:open={deleteOpen}
					title={t('users.deleteTitle')}
					text={t('users.deleteText')}
					action="?/deleteAccount"
					confirmLabel={t('users.delete')}
					danger
				/>
				<ConfirmDialog
					bind:open={declineOpen}
					title={t('users.declineTitle')}
					text={t('users.declineText')}
					action="?/declineDeletion"
					confirmLabel={t('users.declineDeletion')}
				/>
			{/if}
		</div>
	{/if}
</FormSection>
