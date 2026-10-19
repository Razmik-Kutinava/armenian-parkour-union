<script lang="ts">
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { formatPrice } from '#lib/money.ts';

	type Item = { name: string | null; amountMinor: number; currency: string; paidAt: Date };

	/* docs/06 section 4.8: name and amount only; `null` name — the donor asked to stay anonymous. */
	let { items }: { items: Item[] } = $props();
	const id = $props.id();
	const day = (date: Date) =>
		date.toLocaleDateString(currentLocale(), { dateStyle: 'medium', timeZone: 'Asia/Yerevan' });
</script>

<section class="flex flex-col gap-3">
	<h2 {id} class="text-xl font-bold text-ink-900">{t('donate.recent')}</h2>
	<ul aria-labelledby={id} class="flex flex-col divide-y divide-line">
		{#each items as item, i (i)}
			<li class="flex flex-wrap items-baseline justify-between gap-2 py-2">
				<span class="font-bold text-ink-900">{item.name ?? t('donate.anonymousDonor')}</span>
				<span class="text-ink-700">
					{formatPrice(item.amountMinor, item.currency, currentLocale())} · {day(item.paidAt)}
				</span>
			</li>
		{/each}
	</ul>
</section>
