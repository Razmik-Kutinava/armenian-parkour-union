<script lang="ts">
	import MembershipFee from '#lib/components/site/MembershipFee.svelte';
	import { newsDate } from '#lib/components/site/news-date.ts';
	import PayFeeForm from '#lib/components/site/PayFeeForm.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const overview = $derived(data.overview);
	const day = (date: Date | null) => (date ? newsDate(date, currentLocale()) : '…');
</script>

<svelte:head>
	<title>{t('cabinet.membership.title')} — {t('site.name')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex max-w-3xl flex-col gap-6">
	<h1 class="text-3xl font-bold text-ink-900">{t('cabinet.membership.title')}</h1>

	<p class="text-lg font-bold text-ink-900">
		{overview.active && overview.paidUntil
			? t('cabinet.membership.activeUntil', { date: day(overview.paidUntil) })
			: t('cabinet.membership.none')}
	</p>
	{#if overview.waiting}
		<p role="status" class="rounded-md bg-info-bg p-3 text-info-fg">
			{t('cabinet.membership.waiting')}
		</p>
	{/if}

	<MembershipFee fee={data.fee}>
		<PayFeeForm
			label={overview.active ? 'membership.pay.renew' : 'membership.pay.submit'}
			error={form?.payError}
		/>
	</MembershipFee>

	{#if overview.history.length}
		<section class="flex flex-col gap-3">
			<h2 class="text-xl font-bold text-ink-900">{t('cabinet.membership.history')}</h2>
			<ul class="flex flex-col divide-y divide-line">
				{#each overview.history as item, i (i)}
					<li class="flex flex-wrap justify-between gap-2 py-2">
						<span>
							{t('cabinet.membership.period', { from: day(item.startsAt), to: day(item.endsAt) })}
						</span>
						<span class="text-ink-700">{t(`cabinet.membership.status.${item.status}`)}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
