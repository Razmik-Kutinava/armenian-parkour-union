<script lang="ts">
	import type { Snippet } from 'svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { formatPrice } from '#lib/money.ts';

	type Fee = { amountMinor: number; currency: string; periodMonths: number };

	/* docs/06 section 4.9: amount and term from `site_settings.membership_fee`; no fee — no button. */
	let { fee, children }: { fee: Fee | null; children?: Snippet } = $props();
</script>

<section class="flex flex-col gap-4 rounded-md border border-line bg-surface p-5">
	<h2 class="text-xl font-bold text-ink-900">{t('membership.fee.title')}</h2>
	{#if fee}
		<p class="text-lg text-ink-900">
			{t('membership.fee.amount', {
				amount: formatPrice(fee.amountMinor, fee.currency, currentLocale()),
				months: fee.periodMonths
			})}
		</p>
		{@render children?.()}
	{:else}
		<p class="text-ink-700">{t('membership.fee.notSet')}</p>
	{/if}
</section>
