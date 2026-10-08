import { describe, expect, it } from 'vitest';
import { buildSeo, textFromHtml } from './meta';

const base = {
	siteUrl: 'https://parkour.am/',
	siteName: 'Armenian Parkour Union',
	path: '/ru/news/jam',
	locale: 'ru' as const,
	title: 'Джем',
	description: 'Коротко о джеме'
};
const og = (meta: ReturnType<typeof buildSeo>, key: string) =>
	meta.tags.find((t) => t.property === key || t.name === key)?.content;

describe('seo: page meta (docs/06 section 7)', () => {
	it('title, description and an absolute canonical address', () => {
		const meta = buildSeo(base);
		expect(meta.title).toBe('Джем — Armenian Parkour Union');
		expect(meta.description).toBe('Коротко о джеме');
		expect(meta.canonical).toBe('https://parkour.am/ru/news/jam');
	});

	it('Open Graph for messengers: title, description, url, site, locale, type', () => {
		const meta = buildSeo(base);
		expect(og(meta, 'og:title')).toBe('Джем');
		expect(og(meta, 'og:description')).toBe('Коротко о джеме');
		expect(og(meta, 'og:url')).toBe('https://parkour.am/ru/news/jam');
		expect(og(meta, 'og:site_name')).toBe('Armenian Parkour Union');
		expect(og(meta, 'og:locale')).toBe('ru_RU');
		expect(og(meta, 'og:type')).toBe('website');
		expect(og(meta, 'og:image')).toBeUndefined();
		expect(og(meta, 'twitter:card')).toBe('summary');
	});

	it('an image makes a large card with its alt', () => {
		const meta = buildSeo({
			...base,
			image: { url: 'https://media.parkour.am/media/2026/10/a.webp', alt: 'Прыжок' }
		});
		expect(og(meta, 'og:image')).toBe('https://media.parkour.am/media/2026/10/a.webp');
		expect(og(meta, 'og:image:alt')).toBe('Прыжок');
		expect(og(meta, 'twitter:card')).toBe('summary_large_image');
	});

	it('an article adds its dates, tags and Article markup', () => {
		const meta = buildSeo({
			...base,
			image: { url: 'https://media.parkour.am/media/a.webp', alt: '' },
			article: {
				publishedAt: new Date('2026-10-08T08:30:00Z'),
				modifiedAt: new Date('2026-10-09T10:00:00Z'),
				tags: ['jam', 'kids']
			}
		});
		expect(og(meta, 'og:type')).toBe('article');
		expect(og(meta, 'article:published_time')).toBe('2026-10-08T08:30:00.000Z');
		expect(og(meta, 'article:modified_time')).toBe('2026-10-09T10:00:00.000Z');
		expect(meta.tags.filter((t) => t.property === 'article:tag').map((t) => t.content)).toEqual([
			'jam',
			'kids'
		]);
		expect(JSON.parse(meta.jsonLd!)).toEqual({
			'@context': 'https://schema.org',
			'@type': 'Article',
			headline: 'Джем',
			description: 'Коротко о джеме',
			image: ['https://media.parkour.am/media/a.webp'],
			datePublished: '2026-10-08T08:30:00.000Z',
			dateModified: '2026-10-09T10:00:00.000Z',
			inLanguage: 'ru',
			keywords: 'jam, kids',
			mainEntityOfPage: 'https://parkour.am/ru/news/jam',
			author: { '@type': 'Organization', name: 'Armenian Parkour Union' },
			publisher: { '@type': 'Organization', name: 'Armenian Parkour Union' }
		});
	});

	it('an event adds Event markup: dates, status, place, price (docs/06 section 4.3)', () => {
		const event = {
			startsAt: new Date('2026-11-14T07:00:00Z'),
			endsAt: new Date('2026-11-14T14:00:00Z'),
			cancelled: false,
			place: { name: 'Parkour park', address: 'Abovyan 1', city: 'Yerevan' },
			price: { amountMinor: 5000, currency: 'AMD' }
		};
		const meta = buildSeo({
			...base,
			path: '/ru/events/jam',
			image: { url: 'https://media.parkour.am/media/a.webp', alt: '' },
			event
		});
		expect(og(meta, 'og:type')).toBe('website');
		expect(JSON.parse(meta.jsonLd!)).toEqual({
			'@context': 'https://schema.org',
			'@type': 'Event',
			name: 'Джем',
			description: 'Коротко о джеме',
			image: ['https://media.parkour.am/media/a.webp'],
			startDate: '2026-11-14T07:00:00.000Z',
			endDate: '2026-11-14T14:00:00.000Z',
			eventStatus: 'https://schema.org/EventScheduled',
			eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
			inLanguage: 'ru',
			location: {
				'@type': 'Place',
				name: 'Parkour park',
				address: {
					'@type': 'PostalAddress',
					streetAddress: 'Abovyan 1',
					addressLocality: 'Yerevan',
					addressCountry: 'AM'
				}
			},
			offers: {
				'@type': 'Offer',
				price: '5000',
				priceCurrency: 'AMD',
				url: 'https://parkour.am/ru/events/jam'
			},
			organizer: { '@type': 'Organization', name: 'Armenian Parkour Union' }
		});
		const cancelled = buildSeo({
			...base,
			event: {
				...event,
				cancelled: true,
				place: null,
				price: { amountMinor: 1050, currency: 'USD' }
			}
		});
		const ld = JSON.parse(cancelled.jsonLd!);
		expect(ld.eventStatus).toBe('https://schema.org/EventCancelled');
		expect(ld).not.toHaveProperty('location');
		expect(ld.offers.price).toBe('10.50');
	});

	it('markup cannot close its script tag', () => {
		const meta = buildSeo({
			...base,
			title: '</script><script>alert(1)</script>',
			article: { publishedAt: new Date(), modifiedAt: new Date(), tags: [] }
		});
		expect(meta.jsonLd).not.toContain('<');
		expect(JSON.parse(meta.jsonLd!).headline).toBe('</script><script>alert(1)</script>');
	});

	it('text of editor HTML stands in for a missing excerpt', () => {
		expect(textFromHtml('<h2>Jam</h2><p>Bring&nbsp;water &amp; shoes</p><ul><li>a</li></ul>')).toBe(
			'Jam Bring water & shoes a'
		);
	});

	it('a long description is cut on a word to 200 characters', () => {
		const meta = buildSeo({ ...base, description: `${'слово '.repeat(60)}конец` });
		expect(meta.description.length).toBeLessThanOrEqual(200);
		expect(meta.description.endsWith('…')).toBe(true);
		expect(meta.description).not.toMatch(/\s…$/);
	});
});
