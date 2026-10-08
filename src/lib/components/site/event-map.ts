/* questions.md, stage 2 "map": a Google Maps link, no library. */

export type EventPlace = {
	latitude: number | null;
	longitude: number | null;
	locationName: string | null;
	address: string | null;
	city: string | null;
};

const SEARCH = 'https://www.google.com/maps/search/?api=1&query=';

export function mapLink(place: EventPlace): string | null {
	if (place.latitude !== null && place.longitude !== null) {
		return SEARCH + encodeURIComponent(`${place.latitude},${place.longitude}`);
	}
	const text = [place.locationName, place.address, place.city].filter(Boolean).join(', ');
	return text ? SEARCH + encodeURIComponent(text) : null;
}
