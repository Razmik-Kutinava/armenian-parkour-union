<script lang="ts">
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { localizePath } from '#lib/i18n/locales.ts';
	import { formatPrice } from '#lib/money.ts';
	import type { EventCardView } from '#lib/server/services/events/view.ts';
	import EventWindowNote from './EventWindowNote.svelte';
	import { eventDates } from './event-date';
	import { placeholderPhoto } from './placeholder-photo';

	/* docs/06 section 4.2: cover, title, date and time, city, price or "Free", places indicator. */
	type Props = { event: EventCardView; eager?: boolean; showWindow?: boolean; level?: 2 | 3 };
	let { event, eager = false, showWindow = true, level = 2 }: Props = $props();
</script>

<article class="flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
	<div class="aspect-video bg-navy-100">
		<img
			src={event.coverUrl ?? placeholderPhoto(event.slug)}
			alt={event.coverUrl ? event.coverAlt : ''}
			loading={eager ? 'eager' : 'lazy'}
			width="1280"
			height="720"
			class="size-full object-cover"
		/>
	</div>
	<div class="flex flex-1 flex-col gap-2 p-4">
		<time class="text-sm text-ink-500" datetime={event.startsAt.toISOString()}
			>{eventDates(event.startsAt, event.endsAt, currentLocale())}</time
		>
		<svelte:element this={`h${level}`} class="text-lg font-bold text-ink-900">
			<a class="hover:underline" href={localizePath(`/events/${event.slug}`, currentLocale())}
				>{event.title}</a
			>
		</svelte:element>
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
