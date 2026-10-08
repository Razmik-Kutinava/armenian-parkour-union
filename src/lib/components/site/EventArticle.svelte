<script lang="ts">
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { formatPrice } from '#lib/money.ts';
	import type { PublicEvent } from '#lib/server/services/events/public.ts';
	import EventWindowNote from './EventWindowNote.svelte';
	import ShareButton from './ShareButton.svelte';
	import { ageLabel } from './event-age';
	import { eventDates } from './event-date';
	import { mapLink } from './event-map';

	/* docs/06 section 4.3: cover, title, dates, place and map, description, price, categories,
	 * registration block (a placeholder until stage 5), share. HTML was cleaned on save. */
	type Props = { event: PublicEvent & { coverUrl: string | null }; shareUrl: string };
	let { event, shareUrl }: Props = $props();
	const map = $derived(mapLink(event));
	const place = $derived(
		[event.locationName, event.address, event.city].filter(Boolean).join(', ')
	);
	const price = $derived(
		event.priceAmountMinor === 0
			? t('events.free')
			: formatPrice(event.priceAmountMinor, event.priceCurrency, currentLocale())
	);
	const open = $derived(event.status === 'published');
</script>

<article class="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:py-14">
	{#if event.status === 'cancelled'}
		<p role="status" class="rounded-md bg-error-bg p-3 font-bold text-error-fg">
			{t('events.cancelledBanner')}
		</p>
	{:else if event.status === 'finished'}
		<p role="status" class="rounded-md bg-info-bg p-3 font-bold text-info-fg">
			{t('events.finishedBanner')}
		</p>
	{/if}
	<h1 class="text-3xl font-bold text-ink-900 sm:text-4xl">{event.title}</h1>
	{#if event.coverUrl}
		<img
			src={event.coverUrl}
			alt={event.coverAlt}
			width="1280"
			height="720"
			class="aspect-video w-full rounded-lg object-cover"
		/>
	{/if}
	<div class="grid gap-8 lg:grid-cols-[1fr_20rem]">
		<div class="flex flex-col gap-6">
			{#if event.html}
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				<div class="rich-text">{@html event.html}</div>
			{/if}
			{#if event.categories.length}
				<section aria-labelledby="categories-title" class="flex flex-col gap-3">
					<h2 id="categories-title" class="text-xl font-bold text-ink-900">
						{t('events.categories')}
					</h2>
					<ul class="flex flex-col gap-2">
						{#each event.categories as category, i (i)}
							<li class="rounded-md border border-line p-3">
								<span class="font-bold">{category.name}</span>
								<span class="text-ink-700">
									· {t(`events.discipline.${category.discipline}`)}
									{#if ageLabel(category)}· {ageLabel(category)}{/if}
									{#if category.capacity !== null}· {t('events.placesLimit', {
											capacity: category.capacity
										})}{/if}
								</span>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		</div>
		<aside
			class="flex h-fit flex-col gap-4 rounded-lg border border-line bg-surface p-4 lg:sticky lg:top-4"
		>
			<dl class="flex flex-col gap-3 text-sm">
				<div>
					<dt class="font-bold text-ink-900">{t('events.when')}</dt>
					<dd class="text-ink-700">{eventDates(event.startsAt, event.endsAt, currentLocale())}</dd>
				</div>
				{#if place}
					<div>
						<dt class="font-bold text-ink-900">{t('events.where')}</dt>
						<dd class="text-ink-700">{place}</dd>
						{#if map}
							<dd>
								<a class="text-navy-700 underline" href={map} target="_blank" rel="noopener"
									>{t('events.map')}</a
								>
							</dd>
						{/if}
					</div>
				{/if}
				<div>
					<dt class="font-bold text-ink-900">{t('events.price')}</dt>
					<dd class="text-ink-700">{price}</dd>
				</div>
				{#if event.capacity !== null}
					<div>
						<dt class="font-bold text-ink-900">{t('events.places')}</dt>
						<dd class="text-ink-700">{t('events.placesLimit', { capacity: event.capacity })}</dd>
					</div>
				{/if}
			</dl>
			{#if open}
				<p class="text-sm"><EventWindowNote window={event.window} /></p>
				<button
					type="button"
					disabled
					class="min-h-11 rounded-md bg-navy-700 px-4 font-bold text-surface opacity-60"
					>{t('events.register')}</button
				>
				<p class="text-sm text-ink-500">{t('events.registerSoon')}</p>
			{/if}
			<ShareButton title={event.title} url={shareUrl} />
		</aside>
	</div>
</article>
