<script lang="ts">
	import { mediaThumb } from '#lib/components/site/media-photo.ts';
	import { newsDate } from '#lib/components/site/news-date.ts';
	import Badge from '#lib/components/ui/Badge.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import type { PageProps } from './$types';

	/* docs/06 section 4.12: a valid card — photo, name, number, "valid until", partner perks; not
	 * valid — the number only. The cashier's buttons come in 10.6. */
	let { data }: PageProps = $props();
	const card = $derived(data.card);
	const local = (text: Parameters<typeof pickLocalized>[0]) => pickLocalized(text, currentLocale());
</script>

<svelte:head>
	<title>{t('volunteerCards.check.title')} — {t('site.name')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<article class="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:py-14">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<h1 class="text-3xl font-bold text-ink-900 sm:text-4xl">{t('volunteerCards.check.title')}</h1>
		<span role="status">
			<Badge tone={card.valid ? 'success' : 'error'}>
				<span aria-hidden="true">{card.valid ? '✅' : '❌'}</span>
				{card.valid ? t('volunteerCards.check.valid') : t('volunteerCards.check.invalid')}
			</Badge>
		</span>
	</div>

	{#if card.valid}
		<div class="flex flex-col gap-5 rounded-md border border-line bg-surface p-5 sm:flex-row">
			{#if card.photoUrl}
				<img
					src={mediaThumb(card.photoUrl, 320)}
					alt={t('volunteerCards.check.photo', { name: card.holder })}
					class="h-40 w-32 shrink-0 rounded-md border border-line object-cover"
				/>
			{:else}
				<div
					class="flex h-40 w-32 shrink-0 items-center justify-center rounded-md border border-dashed border-line p-2 text-center text-sm text-ink-700"
				>
					{t('volunteerCards.card.noPhoto')}
				</div>
			{/if}
			<dl class="grid content-start gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr]">
				<dt class="font-bold text-ink-700">{t('volunteerCards.check.holder')}</dt>
				<dd class="text-lg font-bold text-ink-900">{card.holder}</dd>
				<dt class="font-bold text-ink-700">{t('volunteerCards.pdf.number')}</dt>
				<dd class="font-mono text-ink-900">{card.number}</dd>
				<dt class="font-bold text-ink-700">{t('volunteerCards.pdf.validUntil')}</dt>
				<dd class="text-ink-900">{newsDate(card.validUntil, currentLocale())}</dd>
			</dl>
		</div>

		<section aria-labelledby="check-perks" class="flex flex-col gap-3">
			<h2 id="check-perks" class="text-xl font-bold text-ink-900">
				{t('volunteerCards.pdf.partners')}
			</h2>
			{#if card.partners.length === 0}
				<p class="text-ink-700">{t('volunteerCards.pdf.empty')}</p>
			{:else}
				<ul class="flex flex-col gap-4">
					{#each card.partners as partner (partner.id)}
						<li class="flex gap-4 rounded-md border border-line p-4">
							{#if partner.logoUrl}
								<img
									src={mediaThumb(partner.logoUrl, 160)}
									alt=""
									class="h-12 w-12 shrink-0 object-contain"
								/>
							{/if}
							<div class="flex flex-col gap-2">
								<h3 class="font-bold text-ink-900">{partner.name}</h3>
								<ul class="flex flex-col gap-2">
									{#each partner.perks as perk (perk.id)}
										<li>
											<p class="text-ink-900">{local(perk.title)}</p>
											{#if perk.terms}
												<p class="text-sm text-ink-700">{local(perk.terms)}</p>
											{/if}
										</li>
									{/each}
								</ul>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{:else}
		<dl
			class="grid gap-x-6 gap-y-3 rounded-md border border-line bg-surface p-5 sm:grid-cols-[auto_1fr]"
		>
			<dt class="font-bold text-ink-700">{t('volunteerCards.pdf.number')}</dt>
			<dd class="font-mono text-ink-900">{card.number}</dd>
		</dl>
	{/if}
</article>
