<script lang="ts">
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { PaymentCard } from '#lib/server/services/payments/admin/index.ts';

	/* docs/05 section 16, docs/07 sections 8-11: by status; the server re-checks every one. */
	let { card }: { card: PaymentCard } = $props();

	const canConfirm = $derived(['pending', 'failed', 'cancelled'].includes(card.status));
	const paid = $derived(card.status === 'paid');
	const canReceipt = $derived(paid && card.kind !== 'event_fee');
	const refundLabel = $derived(
		t(card.refundMode === 'api' ? 'payments.refund' : 'payments.refundManual')
	);
	let confirmOpen = $state(false);
	let refundOpen = $state(false);
	let resolveOpen = $state(false);
</script>

{#if canConfirm || paid || card.needsReview}
	<FormSection title={t('payments.section.actions')}>
		<div class="flex flex-wrap gap-3">
			{#if canConfirm}
				<Button variant="secondary" onclick={() => (confirmOpen = true)}
					>{t('payments.confirm')}</Button
				>
			{/if}
			{#if canReceipt}
				<form method="POST" action="?/receipt">
					<Button type="submit" variant="secondary">{t('payments.receipt')}</Button>
				</form>
			{/if}
			{#if paid}
				<Button variant="danger" onclick={() => (refundOpen = true)}>{refundLabel}</Button>
			{/if}
			{#if card.needsReview}
				<Button variant="secondary" onclick={() => (resolveOpen = true)}
					>{t('payments.resolve')}</Button
				>
			{/if}
		</div>
	</FormSection>
	<ConfirmDialog
		bind:open={confirmOpen}
		title={t('payments.confirmTitle')}
		text={t('payments.confirmText')}
		action="?/confirm"
		confirmLabel={t('payments.confirm')}
		comment="required"
	/>
	<ConfirmDialog
		bind:open={refundOpen}
		title={t('payments.refundTitle')}
		text={t(card.refundMode === 'api' ? 'payments.refundTextApi' : 'payments.refundTextManual')}
		action="?/refund"
		confirmLabel={refundLabel}
		danger
		comment="required"
	/>
	<ConfirmDialog
		bind:open={resolveOpen}
		title={t('payments.resolveTitle')}
		text={t('payments.resolveText')}
		action="?/resolve"
		confirmLabel={t('payments.resolve')}
		comment="required"
	/>
{/if}
