<script lang="ts">
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';

	/* docs/05 section 28 "Cards": issue (confirmation) or reject a pending card, revoke an issued one;
	 * reasons are required. The server re-checks the right, the status and the conditions. */
	let { status }: { status: 'pending' | 'active' | 'rejected' | 'revoked' } = $props();

	type Ask = 'issue' | 'reject' | 'revoke';
	let asked = $state<Ask | null>(null);
	let open = $state(false);
	const ask = (action: Ask) => {
		asked = action;
		open = true;
	};
</script>

{#if status === 'pending' || status === 'active'}
	<FormSection title={t('volunteerCards.card.decision')}>
		<div class="flex flex-wrap gap-3">
			{#if status === 'pending'}
				<Button onclick={() => ask('issue')}>{t('volunteerCards.issue')}</Button>
				<Button variant="danger" onclick={() => ask('reject')}>{t('volunteerCards.reject')}</Button>
			{:else}
				<Button variant="danger" onclick={() => ask('revoke')}>{t('volunteerCards.revoke')}</Button>
			{/if}
		</div>
	</FormSection>
{/if}
{#if asked}
	<ConfirmDialog
		bind:open
		title={t(`volunteerCards.${asked}`)}
		text={t(`volunteerCards.${asked}Text`)}
		action="?/{asked}"
		confirmLabel={t(`volunteerCards.${asked}`)}
		danger={asked !== 'issue'}
		comment={asked === 'issue' ? 'none' : 'required'}
	/>
{/if}
