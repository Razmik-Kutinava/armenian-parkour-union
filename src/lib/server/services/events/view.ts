import { localizePath } from '#lib/i18n/locales.ts';
import { translate } from '#lib/i18n/translate.ts';
import { buildSeo, textFromHtml, type Seo } from '#lib/seo/meta.ts';
import type { SeoBase } from '../seo/base';
import { publicUrl } from '../../storage/r2';
import type { EventCard, PublicEvent } from './public';

/* What the event pages render: cover addresses from R2 and the meta (docs/06 sections 4.3, 7). */

export type EventCardView = EventCard & { coverUrl: string | null };

export const withEventCover = <T extends EventCard>(event: T): T & { coverUrl: string | null } => ({
	...event,
	coverUrl: event.coverKey ? publicUrl(event.coverKey) : null
});

export function eventSeo(event: PublicEvent, base: SeoBase): Seo {
	const coverUrl = event.coverKey ? publicUrl(event.coverKey) : null;
	const hasPlace = event.locationName || event.address || event.city;
	return buildSeo({
		...base,
		path: localizePath(`/events/${event.slug}`, base.locale),
		title: event.title,
		description: textFromHtml(event.html) || translate(base.locale, 'events.list.description'),
		image: coverUrl ? { url: coverUrl, alt: event.coverAlt } : null,
		event: {
			startsAt: event.startsAt,
			endsAt: event.endsAt,
			cancelled: event.status === 'cancelled',
			place: hasPlace
				? { name: event.locationName, address: event.address, city: event.city }
				: null,
			price: { amountMinor: event.priceAmountMinor, currency: event.priceCurrency }
		}
	});
}
