import type { EventDetail } from '#lib/server/services/events/list.ts';
import { minorToInput, type Currency } from '#lib/money.ts';
import { toYerevanInput } from '#lib/validation/posts.ts';
import { flattenValues } from '#lib/validation/site-settings-form.ts';

/** The saved event as form field values: dates in Yerevan time, the price in major units. */
export function formValues(event: EventDetail): Record<string, string> {
	const date = (d: Date | null) => (d ? toYerevanInput(d) : '');
	const num = (n: number | null) => (n === null ? '' : String(n));
	return {
		...flattenValues({ title: event.title, description: event.description }),
		slug: event.slug,
		coverKey: event.coverKey ?? '',
		startsAt: date(event.startsAt),
		endsAt: date(event.endsAt),
		locationName: event.locationName ?? '',
		address: event.address ?? '',
		city: event.city ?? '',
		latitude: num(event.latitude),
		longitude: num(event.longitude),
		capacity: num(event.capacity),
		price: minorToInput(event.priceAmountMinor, event.priceCurrency as Currency),
		priceCurrency: event.priceCurrency,
		registrationOpensAt: date(event.registrationOpensAt),
		registrationClosesAt: date(event.registrationClosesAt),
		status: event.status,
		publishedAt: date(event.publishedAt)
	};
}
