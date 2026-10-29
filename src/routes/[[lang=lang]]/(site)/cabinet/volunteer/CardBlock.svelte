<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '#lib/components/ui/Button.svelte';
	import { currentLocale, localizePath, t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import type { QrSvg } from '#lib/server/services/certificates/qr-svg.ts';
	import type { OwnCard } from '#lib/server/services/volunteer/card-own.ts';

	/* docs/06 section 5.12 "Card": every state; the server re-checks the conditions on apply.
	 * QR and PDF — a valid card only (`qr` is null otherwise). */
	let {
		own,
		qr,
		result
	}: {
		own: OwnCard;
		qr: QrSvg | null;
		result: { applied?: true; message?: MessageKey } | null;
	} = $props();

	const FIX: Partial<Record<OwnCard['missing'][number], string>> = {
		membership: '/cabinet/membership',
		photo: '/cabinet/profile',
		privacy: '/cabinet/documents'
	};
	const card = $derived(own.card);
	const canApply = $derived(
		own.missing.length === 0 && (!card || card.status === 'rejected' || card.status === 'revoked')
	);
	const day = (d: Date) =>
		d.toLocaleDateString(currentLocale(), { dateStyle: 'long', timeZone: 'Asia/Yerevan' });
	const link = 'font-bold text-navy-700 underline underline-offset-2 hover:text-navy-800';
</script>

<section
	aria-labelledby="volunteer-card"
	class="flex flex-col gap-3 rounded-lg border border-line p-4"
>
	<h2 id="volunteer-card" class="text-xl font-bold text-ink-900">{t('cabinet.volunteer.card')}</h2>

	{#if result?.applied}
		<p role="status" class="rounded-md bg-success-bg p-3 text-sm text-success-fg">
			{t('cabinet.volunteer.applied')}
		</p>
	{:else if result?.message}
		<p role="alert" class="rounded-md bg-error-bg p-3 text-sm text-error-fg">{t(result.message)}</p>
	{/if}

	{#if card?.status === 'active' && own.validity?.valid}
		<p class="text-ink-900">
			{t('cabinet.volunteer.number')}: <strong>{card.number}</strong>
		</p>
		<p class="text-ink-900">
			{t('cabinet.volunteer.validUntil', { date: day(own.validity.until) })}
		</p>
		{#if qr}
			<svg
				role="img"
				aria-label={t('cabinet.volunteer.qr')}
				viewBox="-4 -4 {qr.size + 8} {qr.size + 8}"
				shape-rendering="crispEdges"
				class="size-48"
			>
				<rect x="-4" y="-4" width={qr.size + 8} height={qr.size + 8} fill="#fff" />
				<path d={qr.d} fill="#000" />
			</svg>
			<p class="text-sm text-ink-700">{t('cabinet.volunteer.qrHint')}</p>
			<a
				class={link}
				href={localizePath('/cabinet/volunteer/pdf', currentLocale())}
				data-sveltekit-reload>{t('cabinet.volunteer.pdf')}</a
			>
		{/if}
	{:else if card?.status === 'active' && own.validity && !own.validity.valid}
		<div class="rounded-md bg-warning-bg p-3 text-sm text-warning-fg">
			<p>{t('cabinet.volunteer.invalid')}</p>
			<ul class="list-disc pl-5">
				{#each own.validity.reasons as reason (reason)}
					<li>{t(`volunteerCards.invalid.${reason}`)}</li>
				{/each}
			</ul>
		</div>
		{#if own.validity.reasons.includes('membership')}
			<a class={link} href={localizePath('/cabinet/membership', currentLocale())}
				>{t('cabinet.volunteer.renew')}</a
			>
		{/if}
	{:else if card?.status === 'pending'}
		<p class="rounded-md bg-info-bg p-3 text-sm text-info-fg">{t('cabinet.volunteer.pending')}</p>
	{:else if card?.status === 'rejected' || card?.status === 'revoked'}
		<p class="text-ink-900">
			{t(`cabinet.volunteer.${card.status}`, { reason: card.reviewNote ?? '' })}
		</p>
	{:else}
		<p class="text-ink-700">{t('cabinet.volunteer.about')}</p>
	{/if}

	{#if (!card || card.status === 'rejected' || card.status === 'revoked') && own.missing.length > 0}
		<div class="rounded-md bg-info-bg p-3 text-sm text-info-fg">
			<p>{t('cabinet.volunteer.missing')}</p>
			<ul class="list-disc pl-5">
				{#each own.missing as item (item)}
					<li>
						{t(`volunteerCards.missing.${item}`)}
						{#if FIX[item]}
							— <a class={link} href={localizePath(FIX[item], currentLocale())}
								>{t('cabinet.volunteer.fix')}</a
							>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if canApply && !result?.applied}
		<form method="POST" action="?/apply" use:enhance>
			<Button type="submit"
				>{t(card ? 'cabinet.volunteer.applyAgain' : 'cabinet.volunteer.apply')}</Button
			>
		</form>
	{/if}
</section>
