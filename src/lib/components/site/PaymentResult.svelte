<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { currentLocale, localizePath, t } from '#lib/i18n/index.svelte.ts';
	import { formatPrice } from '#lib/money.ts';
	import {
		CHECK_EVERY_MS,
		keepChecking,
		paymentOutcome,
		type ReturnMode,
		type ReturnPayment
	} from './payment-result';

	type Props = {
		payment: ReturnPayment & { amountMinor: number; currency: string };
		mode: ReturnMode;
	};

	/* docs/07 section 3 p. 7: the status we hold; a pending payment is checked again a few times. */
	let { payment, mode }: Props = $props();
	let checks = $state(0);
	const polling = $derived(keepChecking(payment, mode, checks));
	const outcome = $derived(paymentOutcome(payment, mode, !polling));
	const amount = $derived(formatPrice(payment.amountMinor, payment.currency, currentLocale()));
	const link = 'font-bold text-navy-700 underline hover:text-navy-900';

	$effect(() => {
		const done = checks;
		if (!keepChecking(payment, mode, done)) return;
		const timer = setTimeout(async () => {
			try {
				await invalidateAll();
			} finally {
				checks = done + 1;
			}
		}, CHECK_EVERY_MS);
		return () => clearTimeout(timer);
	});
</script>

<svelte:head>
	<title>{t(outcome.title)} — {t('site.name')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<article class="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:py-14">
	<h1 class="text-3xl font-bold text-ink-900 sm:text-4xl">{t(outcome.title)}</h1>
	<p class="text-ink-700">
		{t('payment.amount', { kind: t(`payment.kind.${payment.kind}`), amount })}
	</p>
	<p role="status" class="text-lg text-ink-900">{t(outcome.text)}</p>
	{#if outcome.link}
		<a class={link} href={localizePath(outcome.link.path, currentLocale())}
			>{t(outcome.link.label)}</a
		>
	{/if}
	{#if polling}
		<noscript>
			<a class={link} href="{page.url.pathname}{page.url.search}">{t('payment.refresh')}</a>
		</noscript>
	{/if}
</article>
