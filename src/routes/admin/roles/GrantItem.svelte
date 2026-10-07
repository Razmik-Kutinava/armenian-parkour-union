<script lang="ts">
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';

	let { member }: { member: { id: string; name: string; email: string } } = $props();
	const roles = ['editor', 'moderator', 'admin'] as const;
	let role = $state<(typeof roles)[number]>('editor');
	let open = $state(false);
</script>

<li class="flex flex-wrap items-end gap-3 rounded-md border border-line p-3">
	<div class="min-w-48 flex-1">
		<p class="font-bold">{member.name}</p>
		<p class="text-sm text-ink-700">{member.email}</p>
	</div>
	<div class="min-w-40">
		<Select
			label={t('users.col.role')}
			bind:value={role}
			options={roles.map((r) => ({ value: r, label: t(`role.${r}`) }))}
		/>
	</div>
	<Button variant="secondary" onclick={() => (open = true)}>{t('roles.grant')}</Button>
	<ConfirmDialog
		bind:open
		title={t('roles.grant')}
		text={t('roles.grantText', { name: member.name, role: t(`role.${role}`) })}
		action="?/grant"
		confirmLabel={t('roles.grant')}
	>
		{#snippet fields()}
			<input type="hidden" name="userId" value={member.id} />
			<input type="hidden" name="role" value={role} />
		{/snippet}
	</ConfirmDialog>
</li>
