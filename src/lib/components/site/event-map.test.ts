import { describe, expect, it } from 'vitest';
import { mapLink } from './event-map';

/* questions.md, stage 2 "map": a Google Maps link, no library. */
const place = { latitude: null, longitude: null, locationName: null, address: null, city: null };

describe('events: map link', () => {
	it('coordinates win', () => {
		expect(mapLink({ ...place, latitude: 40.1772, longitude: 44.50349, city: 'Yerevan' })).toBe(
			'https://www.google.com/maps/search/?api=1&query=40.1772%2C44.50349'
		);
	});

	it('otherwise the venue, address and city as text', () => {
		expect(
			mapLink({ ...place, locationName: 'Parkour park', address: 'Abovyan 1', city: 'Yerevan' })
		).toBe(
			'https://www.google.com/maps/search/?api=1&query=Parkour%20park%2C%20Abovyan%201%2C%20Yerevan'
		);
	});

	it('no place, no link', () => {
		expect(mapLink(place)).toBeNull();
	});
});
