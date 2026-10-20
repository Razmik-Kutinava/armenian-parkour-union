<script lang="ts">
	import StatusBadge from '#lib/components/payments/StatusBadge.svelte';
	import { newsDate } from '#lib/components/site/news-date.ts';
	import { currentLocale, localizePath, t } from '#lib/i18n/index.svelte.ts';
	import { formatPrice } from '#lib/money.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const cell = 'px-3 py-2 text-left';
</script>

<svelte:head>
	<title>{t('cabinet.payments.title')} — {t('site.name')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex max-w-3xl flex-col gap-6">
	<h1 class="text-3xl font-bold text-ink-900">{t('cabinet.payments.title')}</h1>
	{#if data.payments.length === 0}
		<p class="text-ink-700">{t('cabinet.payments.empty')}</p>
	{:else}
		<div class="overflow-x-auto rounded-md border border-line bg-surface">
			<table class="w-full text-sm">
				<thead class="border-b border-line text-ink-700">
					<tr>
						<th class={cell} scope="col">{t('payments.col.date')}</th>
						<th class={cell} scope="col">{t('payments.col.kind')}</th>
						<th class="{cell} text-right" scope="col">{t('payments.col.amount')}</th>
						<th class={cell} scope="col">{t('payments.col.status')}</th>
						<th class={cell} scope="col"
							><span class="sr-only">{t('cabinet.payments.receipt')}</span></th
						>
					</tr>
				</thead>
				<tbody class="divide-y divide-line">
					{#each data.payments as payment (payment.id)}
						<tr>
							<td class="{cell} whitespace-nowrap"
								>{newsDate(payment.createdAt, currentLocale())}</td
							>
							<td class={cell}>{t(`payment.kind.${payment.kind}`)}</td>
							<td class="{cell} text-right whitespace-nowrap">
								{formatPrice(payment.amountMinor, payment.currency, currentLocale())}
							</td>
							<td class={cell}><StatusBadge status={payment.status} /></td>
							<td class={cell}>
								{#if payment.hasReceipt}
									<a
										class="font-bold text-navy-700 underline hover:no-underline"
										href={localizePath(`/cabinet/payments/${payment.id}`, currentLocale())}
									>
										{t('cabinet.payments.receipt')}
									</a>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
