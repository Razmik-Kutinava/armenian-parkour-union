import { describe, expect, it } from 'vitest';
import { heroFormSchema, heroTypes } from './hero';
import { formToObject } from './site-settings-form';

/* Admin form "Hero blocks" (docs/05 section 4; rules — docs/todo.md 2.6). */

const EVENT_ID = '7f0c2a8e-1b2c-4d5e-8f90-123456789abc';
const USER_ID = '0b1c2d3e-4f50-4617-8899-aabbccddeeff';
const valid = { type: 'presentation', title: { en: 'Join the federation' } };
const pathOf = (input: Record<string, unknown>) =>
	heroFormSchema.safeParse({ ...valid, ...input }).error?.issues[0].path;

describe('hero: admin form (docs/05 section 4)', () => {
	it('five types from docs/02', () => {
		expect([...heroTypes]).toEqual(['event', 'presentation', 'video', 'person', 'custom']);
		expect(pathOf({ type: 'banner' })).toEqual(['type']);
	});

	it('type and English title are required; the rest is optional and inactive by default', () => {
		expect(heroFormSchema.parse(valid)).toEqual({
			type: 'presentation',
			title: { en: 'Join the federation' },
			subtitle: {},
			mediaKey: null,
			videoUrl: null,
			ctaLabel: null,
			ctaUrl: null,
			eventId: null,
			personUserId: null,
			startsAt: null,
			endsAt: null,
			isActive: false
		});
		expect(heroFormSchema.safeParse({ title: valid.title }).error?.issues[0].path).toEqual([
			'type'
		]);
		expect(pathOf({ title: { ru: 'Вступай' } })).toEqual(['title', 'en']);
		expect(pathOf({ title: { en: 'x'.repeat(201) } })).toEqual(['title', 'en']);
	});

	it('subtitle per language, short plain text', () => {
		expect(
			heroFormSchema.parse({ ...valid, subtitle: { en: ' Train with us ', ru: 'Тренируйся' } })
				.subtitle
		).toEqual({ en: 'Train with us', ru: 'Тренируйся' });
		expect(pathOf({ subtitle: { en: 'x'.repeat(301) } })).toEqual(['subtitle', 'en']);
	});

	it('event block needs an event; other types drop it', () => {
		expect(pathOf({ type: 'event' })).toEqual(['eventId']);
		expect(pathOf({ type: 'event', eventId: 'nope' })).toEqual(['eventId']);
		expect(heroFormSchema.parse({ ...valid, type: 'event', eventId: EVENT_ID }).eventId).toBe(
			EVENT_ID
		);
		expect(heroFormSchema.parse({ ...valid, eventId: EVENT_ID }).eventId).toBeNull();
	});

	it('person block needs a person; other types drop it', () => {
		expect(pathOf({ type: 'person' })).toEqual(['personUserId']);
		expect(
			heroFormSchema.parse({ ...valid, type: 'person', personUserId: USER_ID }).personUserId
		).toBe(USER_ID);
		expect(heroFormSchema.parse({ ...valid, personUserId: USER_ID }).personUserId).toBeNull();
	});

	it('video block needs a YouTube or Instagram link; other types drop it', () => {
		expect(pathOf({ type: 'video' })).toEqual(['videoUrl']);
		expect(pathOf({ type: 'video', videoUrl: 'https://vimeo.com/1' })).toEqual(['videoUrl']);
		for (const videoUrl of [
			'https://youtu.be/kMpYHcuipuY',
			'https://www.instagram.com/reel/C8abc12x/'
		]) {
			expect(heroFormSchema.parse({ ...valid, type: 'video', videoUrl }).videoUrl).toBe(videoUrl);
		}
		expect(
			heroFormSchema.parse({ ...valid, videoUrl: 'https://youtu.be/kMpYHcuipuY' }).videoUrl
		).toBeNull();
	});

	it('background is a library key', () => {
		const key = `media/2026/10/${crypto.randomUUID()}.webp`;
		expect(heroFormSchema.parse({ ...valid, mediaKey: key }).mediaKey).toBe(key);
		expect(pathOf({ mediaKey: 'https://evil.example/a.png' })).toEqual(['mediaKey']);
		expect(pathOf({ mediaKey: 'media/../secret.png' })).toEqual(['mediaKey']);
	});

	it('button: text (English) and link together; link is http(s) or a path on this site', () => {
		expect(
			heroFormSchema.parse({ ...valid, ctaLabel: { en: 'Join', ru: 'Вступить' }, ctaUrl: '/join' })
		).toMatchObject({ ctaLabel: { en: 'Join', ru: 'Вступить' }, ctaUrl: '/join' });
		expect(
			heroFormSchema.parse({
				...valid,
				ctaLabel: { en: 'Tickets' },
				ctaUrl: 'https://tickets.example/fest'
			}).ctaUrl
		).toBe('https://tickets.example/fest');
		expect(pathOf({ ctaUrl: '/join' })).toEqual(['ctaLabel', 'en']);
		expect(pathOf({ ctaLabel: { en: 'Join' } })).toEqual(['ctaUrl']);
		for (const ctaUrl of ['javascript:alert(1)', '//evil.example', '/\\evil.example', 'join']) {
			expect(pathOf({ ctaLabel: { en: 'Join' }, ctaUrl }), ctaUrl).toEqual(['ctaUrl']);
		}
	});

	it('period is Yerevan time, both ends optional, the end is not before the start', () => {
		expect(
			heroFormSchema.parse({ ...valid, startsAt: '2026-11-01T10:00', endsAt: '2026-11-14T22:00' })
		).toMatchObject({
			startsAt: new Date('2026-11-01T06:00:00Z'),
			endsAt: new Date('2026-11-14T18:00:00Z')
		});
		expect(heroFormSchema.parse({ ...valid, endsAt: '2026-11-14T22:00' }).startsAt).toBeNull();
		expect(pathOf({ startsAt: '2026-11-14T10:00', endsAt: '2026-11-14T09:59' })).toEqual([
			'endsAt'
		]);
		expect(pathOf({ startsAt: '2026-13-01T10:00' })).toEqual(['startsAt']);
	});

	it('reads the form fields as sent by the admin page', () => {
		const form = new FormData();
		form.set('type', 'event');
		form.set('title.en', 'Fest');
		form.set('title.ru', '');
		form.set('eventId', EVENT_ID);
		form.set('ctaLabel.en', 'Details');
		form.set('ctaUrl', '/events/fest');
		form.set('isActive', 'on');
		expect(heroFormSchema.parse(formToObject(form))).toMatchObject({
			type: 'event',
			title: { en: 'Fest' },
			eventId: EVENT_ID,
			ctaLabel: { en: 'Details' },
			ctaUrl: '/events/fest',
			isActive: true
		});
	});
});
