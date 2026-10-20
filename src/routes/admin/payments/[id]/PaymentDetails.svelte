<script lang="ts">
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import { currentLocale, t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import { formatPrice } from '#lib/money.ts';
	import type { PaymentCard } from '#lib/server/services/payments/admin/index.ts';

	/* docs/05 section 16: all data of the payment and its links; contacts only for an admin. */
	let { card }: { card: PaymentCard } = $props();

	const when = (d: Date | null) => (d ? d.toLocaleString(currentLocale()) : null);
	const day = (d: Date | null) => (d ? d.toLocaleDateString(currentLocale()) : '—');
	const comment = $derived.by(() => {
		const payload = card.providerPayload as { manual?: { comment?: unknown } } | null;
		const value = payload?.manual?.comment;
		return typeof value === 'string' ? value : null;
	});
	const rows = $derived<[MessageKey, string | null][]>([
		['payments.field.id', card.id],
		['payments.col.kind', t(`payment.kind.${card.kind}`)],
		['payments.col.amount', formatPrice(card.amountMinor, card.currency, currentLocale())],
		['payments.col.provider', card.provider],
		['payments.field.providerPaymentId', card.providerPaymentId],
		['payments.field.createdAt', when(card.createdAt)],
		['payments.field.expiresAt', card.status === 'pending' ? when(card.expiresAt) : null],
		['payments.field.paidAt', when(card.paidAt)],
		['payments.field.refundedAt', when(card.refundedAt)],
		['payments.field.failureReason', card.failureReason],
		['payments.field.email', card.payerEmail],
		[
			'payments.field.purpose',
			card.purposeTitle ? pickLocalized(card.purposeTitle, currentLocale()) : null
		],
		['payments.field.anonymous', card.isAnonymous ? t('payments.yes') : null],
		['payments.field.confirmedBy', card.confirmedByName],
		['payments.field.comment', comment]
	]);
</script>

<FormSection title={t('payments.section.details')}>
	<dl class="grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
		<dt class="font-bold text-ink-700">{t('payments.field.payer')}</dt>
		<dd>
			{#if card.userId}
				<a class="font-bold text-navy-700 hover:underline" href="/admin/users/{card.userId}"
					>{card.payerName ?? card.userId}</a
				>
			{:else}{card.payerName ?? t('payments.guest')}{/if}
		</dd>
		{#each rows as [label, value] (label)}
			{#if value}
				<dt class="font-bold text-ink-700">{t(label)}</dt>
				<dd class="break-all">{value}</dd>
			{/if}
		{/each}
		{#if card.membership}
			<dt class="font-bold text-ink-700">{t('payments.field.membership')}</dt>
			<dd>
				{card.membership.status}
				{#if card.membership.startsAt}({day(card.membership.startsAt)} — {day(
						card.membership.endsAt
					)}){/if}
			</dd>
		{/if}
	</dl>
</FormSection>

<FormSection title={t('payments.section.payload')}>
	<pre class="font-mono overflow-x-auto rounded-md bg-navy-50 p-3 text-xs">{JSON.stringify(
			card.providerPayload ?? null,
			null,
			2
		)}</pre>
</FormSection>
