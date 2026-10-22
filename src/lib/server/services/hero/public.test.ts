import { eq, isNull } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { events } from '../../db/schema/events';
import { heroBlocks } from '../../db/schema/hero';
import { users } from '../../db/schema/users';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { getHeroSlides } from './public';
import {
	DAY,
	birthDateAgo,
	clearHero,
	insertEvent,
	insertImage,
	setHeroLimit
} from './test-support';

/* docs/03 section 11: what the home page shows; fallback — nearest event, else a banner. */

type Block = Partial<typeof heroBlocks.$inferInsert>;

describe.skipIf(!testDbUrl)('hero: blocks on the home page', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	const add = async (tx: LimitDb, values: Block = {}) => {
		const [row] = await tx
			.insert(heroBlocks)
			.values({ type: 'custom', title: { en: 'Hero' }, isActive: true, ...values })
			.returning({ id: heroBlocks.id });
		return row.id;
	};
	const ids = async (tx: LimitDb) => (await getHeroSlides(tx, 'en')).map((s) => s.id);
	/** Fallback tests need no other event in the way. */
	const hideEvents = (tx: LimitDb) =>
		tx.update(events).set({ deletedAt: new Date() }).where(isNull(events.deletedAt));

	it('active blocks inside their period, by order; inactive, archived and out of period are not', async () => {
		await inRollback(async (tx) => {
			await clearHero(tx);
			const now = Date.now();
			const second = await add(tx, { sortOrder: 2 });
			const first = await add(tx, {
				sortOrder: 1,
				startsAt: new Date(now - DAY),
				endsAt: new Date(now + DAY)
			});
			await add(tx, { sortOrder: 0, isActive: false });
			await add(tx, { sortOrder: 0, archivedAt: new Date() });
			await add(tx, { sortOrder: 0, startsAt: new Date(now + DAY) });
			await add(tx, { sortOrder: 0, endsAt: new Date(now - DAY) });
			expect(await ids(tx)).toEqual([first, second]);
		});
	});

	it('texts in the visitor language with English fallback; one button', async () => {
		await inRollback(async (tx) => {
			await clearHero(tx);
			const background = await insertImage(tx);
			await add(tx, {
				type: 'presentation',
				title: { en: 'Join us', ru: 'Вступай' },
				subtitle: { en: 'Parkour in Armenia' },
				mediaKey: background,
				ctaLabel: { en: 'Join', ru: 'Вступить' },
				ctaUrl: '/register'
			});
			expect(await getHeroSlides(tx, 'ru')).toEqual([
				expect.objectContaining({
					type: 'presentation',
					title: 'Вступай',
					subtitle: 'Parkour in Armenia',
					mediaKey: background,
					cta: { label: 'Вступить', url: '/register' },
					event: null,
					person: null,
					video: null
				})
			]);
		});
	});

	it('event block shows the event; hidden once it is unpublished, cancelled or deleted', async () => {
		await inRollback(async (tx) => {
			await clearHero(tx);
			const cover = await insertImage(tx);
			const event = await insertEvent(tx, {
				title: { en: 'Fest' },
				city: 'Yerevan',
				coverKey: cover
			});
			const id = await add(tx, { type: 'event', eventId: event.id, title: { en: 'Big fest' } });
			const [slide] = await getHeroSlides(tx, 'en');
			expect(slide).toMatchObject({
				id,
				type: 'event',
				title: 'Big fest',
				mediaKey: cover,
				event: { slug: event.slug, title: 'Fest', city: 'Yerevan' }
			});
			expect(slide.event?.startsAt).toBeInstanceOf(Date);
			for (const change of [
				{ status: 'draft' as const },
				{ status: 'cancelled' as const },
				{ status: 'archived' as const },
				{ publishedAt: new Date(Date.now() + DAY) },
				{ deletedAt: new Date() }
			]) {
				await tx.update(events).set(change).where(eq(events.id, event.id));
				expect(await ids(tx), JSON.stringify(change)).not.toContain(id);
				await tx
					.update(events)
					.set({ status: 'published', publishedAt: new Date(Date.now() - DAY), deletedAt: null })
					.where(eq(events.id, event.id));
			}
		});
	});

	it('person block shows only the name and the avatar of an active adult (K4)', async () => {
		await inRollback(async (tx) => {
			await clearHero(tx);
			const avatar = await insertImage(tx);
			const person = await insertUser(tx, {
				name: 'Aram Petrosyan',
				avatarKey: avatar,
				birthDate: birthDateAgo(25),
				phone: '+374 10 111111'
			});
			const id = await add(tx, { type: 'person', personUserId: person.id });
			const [slide] = await getHeroSlides(tx, 'en');
			expect(slide.person).toEqual({ name: 'Aram Petrosyan', avatarKey: avatar });
			expect(JSON.stringify(slide)).not.toMatch(/example\.com|111111|birth/i);
			for (const change of [
				{ birthDate: birthDateAgo(17) },
				{ birthDate: null },
				{ status: 'blocked' as const },
				{ deletedAt: new Date() }
			]) {
				await tx.update(users).set(change).where(eq(users.id, person.id));
				expect(await ids(tx), JSON.stringify(change)).not.toContain(id);
				await tx
					.update(users)
					.set({ birthDate: birthDateAgo(25), status: 'active', deletedAt: null })
					.where(eq(users.id, person.id));
			}
		});
	});

	it('video block carries the parsed link', async () => {
		await inRollback(async (tx) => {
			await clearHero(tx);
			await add(tx, { type: 'video', videoUrl: 'https://youtu.be/kMpYHcuipuY' });
			expect((await getHeroSlides(tx, 'en'))[0].video).toEqual({
				kind: 'youtube',
				id: 'kMpYHcuipuY'
			});
		});
	});

	it('never more than the limit, even if the limit was lowered later', async () => {
		await inRollback(async (tx) => {
			await clearHero(tx);
			await setHeroLimit(tx, 2);
			const first = await add(tx, { sortOrder: 0 });
			const second = await add(tx, { sortOrder: 1 });
			await add(tx, { sortOrder: 2 });
			expect(await ids(tx)).toEqual([first, second]);
		});
	});

	it('no blocks: the nearest published upcoming event', async () => {
		await inRollback(async (tx) => {
			await clearHero(tx);
			await hideEvents(tx);
			await insertEvent(tx, {
				startsAt: new Date(Date.now() + 9 * DAY),
				endsAt: new Date(Date.now() + 10 * DAY)
			});
			const near = await insertEvent(tx, { title: { en: 'Soon' } });
			await insertEvent(tx, { status: 'draft', startsAt: new Date(Date.now() + DAY) });
			await add(tx, { isActive: false });
			expect(await getHeroSlides(tx, 'en')).toEqual([
				expect.objectContaining({
					id: null,
					type: 'event',
					title: 'Soon',
					event: expect.objectContaining({ slug: near.slug })
				})
			]);
		});
	});

	it('no blocks and no events: the general banner', async () => {
		await inRollback(async (tx) => {
			await clearHero(tx);
			await hideEvents(tx);
			expect(await getHeroSlides(tx, 'en')).toEqual([
				expect.objectContaining({ id: null, type: 'banner' })
			]);
		});
	});
});
