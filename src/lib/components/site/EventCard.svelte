<script lang="ts">
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { localizePath } from '#lib/i18n/locales.ts';
	import { formatPrice } from '#lib/money.ts';
	import type { EventCardView } from '#lib/server/services/events/view.ts';
	import EventWindowNote from './EventWindowNote.svelte';
	import { eventDates } from './event-date';

	/* docs/06 section 4.2: cover, title, date and time, city, price or "Free", places indicator. */
	type Props = { event: EventCardView; eager?: boolean; showWindow?: boolean };
	let { event, eager = false, showWindow = true }: Props = $props();
</script>

<article class="flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
	<div class="aspect-video bg-navy-100">
		{#if event.coverUrl}
			<img
				src={event.coverUrl}
				alt={event.coverAlt}
				loading={eager ? 'eager' : 'lazy'}
				width="1280"
				height="720"
				class="size-full object-cover"
			/>
		{/if}
	</div>
	<div class="flex flex-1 flex-col gap-2 p-4">
		<time class="text-sm text-ink-500" datetime={event.startsAt.toISOString()}
			>{eventDates(event.startsAt, event.endsAt, currentLocale())}</time
		>
		<h2 class="text-lg font-bold text-ink-900">
			<a class="hover:underline" href={localizePath(`/events/${event.slug}`, currentLocale())}
				>{event.title}</a
			>
		</h2>
		<p class="mt-auto flex flex-wrap justify-between gap-2 pt-2 text-sm">
			<span class="text-ink-700">
				{#if event.city}{event.city} ·
				{/if}{event.priceAmountMinor === 0
					? t('events.free')
					: formatPrice(event.priceAmountMinor, event.priceCurrency, currentLocale())}
			</span>
			{#if showWindow}<EventWindowNote window={event.window} />{/if}
		</p>
	</div>
</article>
