import { minorToInput, type Currency } from '#lib/money.ts';
import type { SeoEvent, SeoInput } from './meta';

/* docs/06 section 4.3: schema.org Event for search engines. */

const SCHEMA = 'https://schema.org/';

export function eventMarkup(
	input: SeoInput,
	event: SeoEvent,
	description: string,
	canonical: string,
	organizer: Record<string, string>
) {
	const { place, price } = event;
	return {
		'@context': 'https://schema.org',
		'@type': 'Event',
		name: input.title,
		description,
		...(input.image && { image: [input.image.url] }),
		startDate: event.startsAt.toISOString(),
		endDate: event.endsAt.toISOString(),
		eventStatus: `${SCHEMA}${event.cancelled ? 'EventCancelled' : 'EventScheduled'}`,
		eventAttendanceMode: `${SCHEMA}OfflineEventAttendanceMode`,
		inLanguage: input.locale,
		...(place && {
			location: {
				'@type': 'Place',
				...(place.name && { name: place.name }),
				address: {
					'@type': 'PostalAddress',
					...(place.address && { streetAddress: place.address }),
					...(place.city && { addressLocality: place.city }),
					addressCountry: 'AM'
				}
			}
		}),
		offers: {
			'@type': 'Offer',
			price: minorToInput(price.amountMinor, price.currency as Currency),
			priceCurrency: price.currency,
			url: canonical
		},
		organizer
	};
}
