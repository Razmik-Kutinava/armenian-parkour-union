import { eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { eventCategories, events } from '../../db/schema/events';
import { media } from '../../db/schema/service';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { richTextSchema } from '../../rich-text/schema';
import { deleteMedia } from '../media/edit';
import { findUsages } from '../media/usage';
import {
	EVENTS_PAGE_SIZE,
	getEventPreview,
	getPublicEvent,
	listArchivedEvents,
	listUpcomingCities,
	listUpcomingEvents
} from './public';

const BASE = 'https://media.parkour.am';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ago = (seconds: number) => sql`now() - make_interval(secs => ${seconds})` as unknown as Date;

/* docs/06 sections 4.2–4.3; visibility — docs/03 section 7.1, 7.9; decisions.md 2026-10-08 (2.5). */
describe.skipIf(!testDbUrl)('events: public view', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	const addEvent = async (tx: LimitDb, values: Partial<typeof events.$inferInsert> = {}) => {
		const startsAt = values.startsAt ?? new Date(Date.now() + 5 * DAY);
		const [row] = await tx
			.insert(events)
			.values({
				slug: `t-${crypto.randomUUID().slice(0, 8)}`,
				title: { en: 'Open jam', ru: 'Открытый джем' },
				description: { en: '<p>English</p>', hy: '<p>Հայերեն</p>' },
				status: 'published',
				publishedAt: ago(60),
				startsAt,
				endsAt: new Date(startsAt.getTime() + 6 * HOUR),
				city: 'Yerevan',
				...values
			})
			.returning();
		return row;
	};
	const city = () => `City ${crypto.randomUUID().slice(0, 8)}`;
	type Query = Parameters<typeof listUpcomingEvents>[1];
	const upcoming = (tx: LimitDb, c: string, extra: Partial<Query> = {}) =>
		listUpcomingEvents(tx, { locale: 'en', city: c, page: 1, ...extra });
	const slugs = async (tx: LimitDb, c: string, extra: Partial<Query> = {}) =>
		(await upcoming(tx, c, extra)).rows.map((r) => r.slug);

	it('an event page in the language asked, English when missing, with its categories', async () => {
		await inRollback(async (tx) => {
			const event = await addEvent(tx, {
				locationName: 'Parkour park',
				address: 'Abovyan 1',
				latitude: 40.1772,
				longitude: 44.50349,
				capacity: 40,
				priceAmountMinor: 5000
			});
			await tx.insert(eventCategories).values([
				{ eventId: event.id, name: { en: 'Pro', ru: 'Профи' }, discipline: 'style', sortOrder: 2 },
				{
					eventId: event.id,
					name: { en: 'Kids' },
					discipline: 'speed',
					ageMin: 8,
					ageMax: 12,
					capacity: 10,
					sortOrder: 1
				}
			]);
			expect(await getPublicEvent(tx, event.slug, 'ru')).toMatchObject({
				id: event.id,
				slug: event.slug,
				title: 'Открытый джем',
				html: '<p>English</p>',
				status: 'published',
				city: 'Yerevan',
				locationName: 'Parkour park',
				address: 'Abovyan 1',
				latitude: 40.1772,
				longitude: 44.50349,
				capacity: 40,
				priceAmountMinor: 5000,
				priceCurrency: 'AMD',
				startsAt: event.startsAt,
				endsAt: event.endsAt,
				window: { state: 'open' },
				categories: [
					{ name: 'Kids', discipline: 'speed', ageMin: 8, ageMax: 12, capacity: 10 },
					{ name: 'Профи', discipline: 'style', ageMin: null, ageMax: null, capacity: null }
				]
			});
			expect((await getPublicEvent(tx, event.slug, 'hy'))?.html).toBe('<p>Հայերեն</p>');
		});
	});

	it('draft, archived, deleted, scheduled and dateless events are hidden everywhere', async () => {
		await inRollback(async (tx) => {
			const c = city();
			const hidden = [
				await addEvent(tx, { city: c, status: 'draft' }),
				await addEvent(tx, { city: c, status: 'archived' }),
				await addEvent(tx, { city: c, deletedAt: new Date() }),
				await addEvent(tx, { city: c, publishedAt: new Date(Date.now() + HOUR) }),
				await addEvent(tx, { city: c, publishedAt: null })
			];
			for (const event of hidden) {
				expect(await getPublicEvent(tx, event.slug, 'en'), event.status).toBeNull();
			}
			expect(await upcoming(tx, c)).toEqual({ rows: [], total: 0 });
			expect(await listUpcomingCities(tx)).not.toContain(c);
		});
	});

	it('cancelled: the page opens with its status, but it is not listed', async () => {
		await inRollback(async (tx) => {
			const c = city();
			const event = await addEvent(tx, { city: c, status: 'cancelled' });
			expect((await getPublicEvent(tx, event.slug, 'en'))?.status).toBe('cancelled');
			expect(await slugs(tx, c)).toEqual([]);
		});
	});

	it('list: published until the end, soonest first, 12 per page', async () => {
		await inRollback(async (tx) => {
			const c = city();
			const made = [];
			for (let i = 0; i < EVENTS_PAGE_SIZE + 1; i++) {
				made.push(await addEvent(tx, { city: c, startsAt: new Date(Date.now() + (i + 1) * DAY) }));
			}
			const running = await addEvent(tx, {
				city: c,
				startsAt: new Date(Date.now() - HOUR),
				endsAt: new Date(Date.now() + HOUR)
			});
			await addEvent(tx, {
				city: c,
				startsAt: new Date(Date.now() - 2 * DAY),
				endsAt: new Date(Date.now() - DAY)
			});
			await addEvent(tx, { city: c, status: 'finished', startsAt: new Date(Date.now() + DAY) });
			const first = await upcoming(tx, c);
			expect(EVENTS_PAGE_SIZE).toBe(12);
			expect(first.total).toBe(14);
			expect(first.rows.map((r) => r.slug)).toEqual(
				[running, ...made.slice(0, 11)].map((e) => e.slug)
			);
			expect(first.rows[0]).not.toHaveProperty('html');
			const second = await upcoming(tx, c, { page: 2 });
			expect(second.rows.map((r) => r.slug)).toEqual(made.slice(11).map((e) => e.slug));
		});
	});

	it('filters: period, free / paid, discipline of a category; cities of listed events', async () => {
		await inRollback(async (tx) => {
			const c = city();
			const soon = await addEvent(tx, { city: c, startsAt: new Date(Date.now() + 2 * DAY) });
			const inMonth = await addEvent(tx, {
				city: c,
				startsAt: new Date(Date.now() + 20 * DAY),
				priceAmountMinor: 3000
			});
			const later = await addEvent(tx, { city: c, startsAt: new Date(Date.now() + 60 * DAY) });
			const far = await addEvent(tx, { city: c, startsAt: new Date(Date.now() + 120 * DAY) });
			await tx.insert(eventCategories).values([
				{ eventId: inMonth.id, name: { en: 'A' }, discipline: 'tricking' },
				{ eventId: inMonth.id, name: { en: 'B' }, discipline: 'speed' },
				{ eventId: later.id, name: { en: 'C' }, discipline: 'tricking' }
			]);
			expect(await slugs(tx, c, { period: 'week' })).toEqual([soon.slug]);
			expect(await slugs(tx, c, { period: 'month' })).toEqual([soon.slug, inMonth.slug]);
			expect(await slugs(tx, c, { period: '3months' })).toEqual([
				soon.slug,
				inMonth.slug,
				later.slug
			]);
			expect(await slugs(tx, c)).toEqual([soon.slug, inMonth.slug, later.slug, far.slug]);
			expect(await slugs(tx, c, { price: 'paid' })).toEqual([inMonth.slug]);
			expect(await slugs(tx, c, { price: 'free' })).toEqual([soon.slug, later.slug, far.slug]);
			expect(await slugs(tx, c, { discipline: 'tricking' })).toEqual([inMonth.slug, later.slug]);
			expect(await listUpcomingCities(tx)).toContain(c);
		});
	});

	it('card: registration window indicator, cover alt from the library', async () => {
		await inRollback(async (tx) => {
			const c = city();
			const owner = await insertUser(tx);
			const key = `media/2026/10/${crypto.randomUUID()}.png`;
			await tx.insert(media).values({
				key,
				originalName: 'a.png',
				mime: 'image/png',
				sizeBytes: 10,
				uploadedBy: owner.id,
				alt: { en: 'Jumper', ru: 'Прыжок' }
			});
			const opensAt = new Date(Date.now() + DAY);
			const event = await addEvent(tx, { city: c, coverKey: key, registrationOpensAt: opensAt });
			const closed = await addEvent(tx, {
				city: c,
				registrationClosesAt: new Date(Date.now() - HOUR),
				startsAt: new Date(Date.now() + 6 * DAY)
			});
			const { rows } = await listUpcomingEvents(tx, { locale: 'ru', city: c, page: 1 });
			expect(rows[0]).toMatchObject({
				slug: event.slug,
				title: 'Открытый джем',
				coverKey: key,
				coverAlt: 'Прыжок',
				city: c,
				window: { state: 'not_open', opensAt }
			});
			expect(rows[1]).toMatchObject({ slug: closed.slug, window: { state: 'closed' } });
		});
	});

	it('archive: finished events, latest first; nothing else', async () => {
		await inRollback(async (tx) => {
			const finished = await addEvent(tx, {
				status: 'finished',
				startsAt: new Date(Date.now() - HOUR),
				endsAt: new Date(Date.now() - 1000)
			});
			const past = await addEvent(tx, {
				startsAt: new Date(Date.now() - 2 * HOUR),
				endsAt: new Date(Date.now() - HOUR)
			});
			const deleted = await addEvent(tx, { status: 'finished', deletedAt: new Date() });
			const { rows, total } = await listArchivedEvents(tx, { locale: 'en', page: 1 });
			const shown = rows.map((r) => r.slug);
			expect(shown[0]).toBe(finished.slug);
			expect(shown).not.toContain(past.slug);
			expect(shown).not.toContain(deleted.slug);
			expect(total).toBeGreaterThanOrEqual(1);
			expect((await getPublicEvent(tx, finished.slug, 'en'))?.status).toBe('finished');
		});
	});

	it('preview shows a saved event in any status, except a deleted one', async () => {
		await inRollback(async (tx) => {
			const draft = await addEvent(tx, { status: 'draft', publishedAt: null });
			expect(await getEventPreview(tx, draft.id, 'en')).toMatchObject({ slug: draft.slug });
			const deleted = await addEvent(tx, { deletedAt: new Date() });
			expect(await getEventPreview(tx, deleted.id, 'en')).toBeNull();
			expect(await getEventPreview(tx, 'nope', 'en')).toBeNull();
		});
	});
});

describe.skipIf(!testDbUrl)('events: media used as cover or in the description', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a cover or a description image is in use; a deleted event frees it', async () => {
		await inRollback(async (tx) => {
			const editor = await insertUser(tx, { role: 'editor' });
			const file = async () => {
				const [row] = await tx
					.insert(media)
					.values({
						key: `media/2026/10/${crypto.randomUUID()}.png`,
						originalName: 'a.png',
						mime: 'image/png',
						sizeBytes: 10,
						uploadedBy: editor.id
					})
					.returning();
				return row;
			};
			const cover = await file();
			const inText = await file();
			const [event] = await tx
				.insert(events)
				.values({
					slug: `t-${crypto.randomUUID().slice(0, 8)}`,
					title: { en: 'Gallery' },
					coverKey: cover.key,
					description: {
						ru: richTextSchema(BASE).parse(`<p><img src="${BASE}/${inText.key}" alt=""></p>`)
					},
					startsAt: new Date(),
					endsAt: new Date()
				})
				.returning();
			const actor = { id: editor.id, role: 'editor' as const };
			for (const f of [cover, inText]) {
				expect(await findUsages(tx, f.key)).toEqual([{ kind: 'event', id: event.id }]);
				expect(await deleteMedia(tx, actor, f.id, null)).toEqual({
					inUse: [{ kind: 'event', id: event.id }]
				});
			}
			await tx.update(events).set({ deletedAt: new Date() }).where(eq(events.id, event.id));
			expect(await findUsages(tx, cover.key)).toEqual([]);
			expect(await findUsages(tx, inText.key)).toEqual([]);
		});
	});
});
