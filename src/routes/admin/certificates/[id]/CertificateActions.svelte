<script lang="ts">
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';

	/* docs/05 section 8: open and remake the PDF, revoke with a reason (admin); the server re-checks. */
	let {
		pdfUrl,
		canRemake,
		canRevoke
	}: { pdfUrl: string | null; canRemake: boolean; canRevoke: boolean } = $props();
	let revokeOpen = $state(false);
</script>

<FormSection title={t('certificates.card.pdf')}>
	{#if pdfUrl}
		<a
			class="w-fit font-bold text-navy-700 underline"
			href={pdfUrl}
			target="_blank"
			rel="noopener noreferrer">{t('certificates.card.pdfOpen')}</a
		>
		<p class="text-sm text-ink-700">{t('certificates.card.pdfHint')}</p>
	{:else}
		<p class="text-ink-700">{t('certificates.card.pdfNone')}</p>
	{/if}
	{#if canRemake || canRevoke}
		<div class="flex flex-wrap gap-3">
			{#if canRemake}
				<form method="POST" action="?/pdf">
					<Button type="submit" variant="secondary">{t('certificates.card.remake')}</Button>
				</form>
			{/if}
			{#if canRevoke}
				<Button variant="danger" onclick={() => (revokeOpen = true)}
					>{t('certificates.card.revoke')}</Button
				>
			{/if}
		</div>
	{/if}
</FormSection>
{#if canRevoke}
	<ConfirmDialog
		bind:open={revokeOpen}
		title={t('certificates.card.revokeTitle')}
		text={t('certificates.card.revokeText')}
		action="?/revoke"
		confirmLabel={t('certificates.card.revoke')}
		danger
		comment="required"
	/>
{/if}
