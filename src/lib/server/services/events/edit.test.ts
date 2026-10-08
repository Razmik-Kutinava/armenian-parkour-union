import { eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { EventValues } from '#lib/validation/events.ts';
import type { LimitDb } from '../../auth/rate-limit';
import type { UserRole } from '../../auth/session';
import { eventCategories, events } from '../../db/schema/events';
import { auditLog, media } from '../../db/schema/service';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { createEventCategory, listEventCategories } from './categories';
import {
	cancelEvent,
	changeEventStatus,
	createEvent,
	deleteEvent,
	duplicateEvent,
	updateEvent
} from './edit';
import { getEvent } from './list';

const IP = '198.51.100.7';
const DAY = 86_400_000;
const values = (slug: string, extra: Partial<EventValues> = {}): EventValues => ({
	slug,
	title: { en: 'Open jam' },
	description: { en: '<p>Bring water</p>' },
	coverKey: null,
	startsAt: new Date(Date.now() + 10 * DAY),
	endsAt: new Date(Date.now() + 10 * DAY + 6 * 3_600_000),
	locationName: 'Parkour park',
	address: 'Abovyan 1',
	city: 'Yerevan',
	latitude: 40.1772,
	longitude: 44.50349,
	capacity: 40,
	priceAmountMinor: 5000,
	priceCurrency: 'AMD',
	registrationOpensAt: null,
	registrationClosesAt: null,
	status: 'draft',
	publishedAt: null,
	...extra
});

describe.skipIf(!testDbUrl)('events: admin edits (docs/05 section 5, docs/04)', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	const staff = async (tx: LimitDb, role: UserRole = 'editor') => ({
		id: (await insertUser(tx, { role })).id,
		role
	});
	const slug = () => `t-${crypto.randomUUID().slice(0, 8)}`;
	const auditOf = (tx: LimitDb, id: string) =>
		tx.select().from(auditLog).where(eq(auditLog.entityId, id));
	const created = async (tx: LimitDb, actor: { id: string; role: UserRole }, v: EventValues) => {
		const result = await createEvent(tx, actor, v, IP);
		if (typeof result === 'string') throw new Error(result);
		return result.id;
	};
	const addMedia = async (tx: LimitDb, mime = 'image/png') => {
		const owner = await insertUser(tx);
		const key = `media/2026/10/${crypto.randomUUID()}.${mime === 'image/png' ? 'png' : 'pdf'}`;
		await tx
			.insert(media)
			.values({ key, originalName: 'a', mime, sizeBytes: 10, uploadedBy: owner.id });
		return key;
	};
	const statusOf = async (tx: LimitDb, id: string) => (await getEvent(tx, id))?.status;

	it('editor creates a draft with every field; created_by is the editor; it is logged', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx);
			const v = values(slug());
			const id = await created(tx, actor, v);
			expect(await getEvent(tx, id)).toMatchObject({ ...v, createdBy: actor.id });
			const [entry] = await auditOf(tx, id);
			expect(entry).toMatchObject({
				action: 'event.create',
				actorId: actor.id,
				entityType: 'event',
				after: { slug: v.slug, title: v.title, status: 'draft', publishedAt: null },
				ip: IP
			});
		});
	});

	it('published without a date gets now; a future date is kept', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx);
			const now = await created(tx, actor, values(slug(), { status: 'published' }));
			const at = (await getEvent(tx, now))?.publishedAt;
			expect(Math.abs(at!.getTime() - Date.now())).toBeLessThan(60_000);
			const future = new Date(Date.now() + DAY);
			const later = await created(
				tx,
				actor,
				values(slug(), { status: 'published', publishedAt: future })
			);
			expect((await getEvent(tx, later))?.publishedAt?.getTime()).toBe(future.getTime());
		});
	});

	it('a taken address is refused, also after the event is deleted', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx);
			const s = slug();
			const id = await created(tx, actor, values(s));
			expect(await createEvent(tx, actor, values(s), IP)).toBe('slug_taken');
			expect(await deleteEvent(tx, actor, id, IP)).toBe('ok');
			expect(await createEvent(tx, actor, values(s), IP)).toBe('slug_taken');
			const other = await created(tx, actor, values(slug()));
			expect(await updateEvent(tx, actor, other, values(s), IP)).toBe('slug_taken');
		});
	});

	it('cover is an image from the library', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx);
			const image = await addMedia(tx);
			const id = await created(tx, actor, values(slug(), { coverKey: image }));
			expect((await getEvent(tx, id))?.coverKey).toBe(image);
			const pdf = await addMedia(tx, 'application/pdf');
			for (const coverKey of [pdf, `media/2026/10/${crypto.randomUUID()}.png`]) {
				expect(await createEvent(tx, actor, values(slug(), { coverKey }), IP)).toBe('bad_cover');
				expect(await updateEvent(tx, actor, id, values(slug(), { coverKey }), IP)).toBe(
					'bad_cover'
				);
			}
		});
	});

	it('update saves every field and logs only what changed', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx);
			const s = slug();
			const id = await created(tx, actor, values(s));
			const next = values(s, {
				title: { en: 'Open jam', ru: 'Открытый джем' },
				city: 'Gyumri',
				priceAmountMinor: 0,
				capacity: null,
				description: { en: '<p>New</p>' }
			});
			expect(await updateEvent(tx, actor, id, next, IP)).toBe('ok');
			expect(await getEvent(tx, id)).toMatchObject(next);
			const updates = (await auditOf(tx, id)).filter((e) => e.action === 'event.update');
			expect(updates).toHaveLength(1);
			expect(updates[0]).toMatchObject({
				before: {
					title: { en: 'Open jam' },
					city: 'Yerevan',
					priceAmountMinor: 5000,
					capacity: 40
				},
				after: {
					title: next.title,
					city: 'Gyumri',
					priceAmountMinor: 0,
					capacity: null,
					descriptionChanged: true
				}
			});
			expect(updates[0].before).not.toHaveProperty('slug');
			expect(await updateEvent(tx, actor, id, next, IP)).toBe('ok');
			expect((await auditOf(tx, id)).filter((e) => e.action === 'event.update')).toHaveLength(1);
		});
	});

	it('saving the form of a finished, cancelled or archived event keeps its status', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx, 'admin');
			const id = await created(tx, admin, values(slug()));
			expect(await cancelEvent(tx, admin, id, 'Bad weather', IP)).toBe('ok');
			const v = values((await getEvent(tx, id))!.slug, { status: 'published', city: 'Vanadzor' });
			expect(await updateEvent(tx, admin, id, v, IP)).toBe('ok');
			expect(await getEvent(tx, id)).toMatchObject({ status: 'cancelled', city: 'Vanadzor' });
		});
	});

	it('editor publishes and unpublishes; both are logged with the status', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx);
			const id = await created(tx, actor, values(slug()));
			expect(await changeEventStatus(tx, actor, id, 'publish', IP)).toBe('ok');
			const published = await getEvent(tx, id);
			expect(published?.status).toBe('published');
			expect(published?.publishedAt).toBeInstanceOf(Date);
			expect(await changeEventStatus(tx, actor, id, 'publish', IP)).toBe('bad_status');
			expect(await changeEventStatus(tx, actor, id, 'unpublish', IP)).toBe('ok');
			expect(await statusOf(tx, id)).toBe('draft');
			const updates = (await auditOf(tx, id)).filter((e) => e.action === 'event.update');
			expect(updates.map((e) => [e.before, e.after])).toEqual([
				[{ status: 'draft' }, expect.objectContaining({ status: 'published' })],
				[{ status: 'published' }, { status: 'draft' }]
			]);
		});
	});

	it('editor cannot cancel, finish, archive or restore (docs/04: admin only)', async () => {
		await inRollback(async (tx) => {
			const editor = await staff(tx);
			const id = await created(tx, editor, values(slug(), { status: 'published' }));
			expect(await cancelEvent(tx, editor, id, 'No', IP)).toBe('not_allowed');
			for (const action of ['finish', 'archive', 'restore'] as const) {
				expect(await changeEventStatus(tx, editor, id, action, IP), action).toBe('not_allowed');
			}
			expect(await statusOf(tx, id)).toBe('published');
		});
	});

	it('admin cancels with a reason in the log; a cancelled event is not published again', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx, 'admin');
			const id = await created(tx, admin, values(slug(), { status: 'published' }));
			expect(await cancelEvent(tx, admin, id, 'Bad weather', IP)).toBe('ok');
			expect(await statusOf(tx, id)).toBe('cancelled');
			const [entry] = (await auditOf(tx, id)).filter((e) => e.action === 'event.cancel');
			expect(entry).toMatchObject({
				actorId: admin.id,
				before: { status: 'published' },
				after: { status: 'cancelled', reason: 'Bad weather' },
				ip: IP
			});
			expect(await cancelEvent(tx, admin, id, 'Again', IP)).toBe('bad_status');
			expect(await changeEventStatus(tx, admin, id, 'publish', IP)).toBe('bad_status');
			expect(await changeEventStatus(tx, admin, id, 'finish', IP)).toBe('bad_status');
		});
	});

	it('finish: only a published event that has started', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx, 'admin');
			const ahead = await created(tx, admin, values(slug(), { status: 'published' }));
			expect(await changeEventStatus(tx, admin, ahead, 'finish', IP)).toBe('bad_status');
			const started = await created(
				tx,
				admin,
				values(slug(), {
					status: 'published',
					startsAt: new Date(Date.now() - DAY),
					endsAt: new Date(Date.now() - DAY / 2)
				})
			);
			expect(await changeEventStatus(tx, admin, started, 'finish', IP)).toBe('ok');
			expect(await statusOf(tx, started)).toBe('finished');
			const draft = await created(
				tx,
				admin,
				values(slug(), { startsAt: new Date(Date.now() - DAY) })
			);
			expect(await changeEventStatus(tx, admin, draft, 'finish', IP)).toBe('bad_status');
		});
	});

	it('archive from any status; restore brings an archived event back as a draft', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx, 'admin');
			const id = await created(tx, admin, values(slug(), { status: 'published' }));
			expect(await changeEventStatus(tx, admin, id, 'restore', IP)).toBe('bad_status');
			expect(await changeEventStatus(tx, admin, id, 'archive', IP)).toBe('ok');
			expect(await statusOf(tx, id)).toBe('archived');
			expect(await changeEventStatus(tx, admin, id, 'archive', IP)).toBe('bad_status');
			expect(await changeEventStatus(tx, admin, id, 'unpublish', IP)).toBe('bad_status');
			expect(await changeEventStatus(tx, admin, id, 'restore', IP)).toBe('ok');
			expect(await statusOf(tx, id)).toBe('draft');
		});
	});

	it('duplicate: a draft copy with categories, dates and price, free address, no date', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx);
			const s = slug();
			const source = await created(tx, actor, values(s, { status: 'published' }));
			await createEventCategory(
				tx,
				actor,
				source,
				{
					name: { en: 'Kids' },
					discipline: 'speed',
					ageMin: 8,
					ageMax: 12,
					capacity: 10,
					sortOrder: 1
				},
				IP
			);
			const other = await staff(tx, 'admin');
			const first = await duplicateEvent(tx, other, source, IP);
			const second = await duplicateEvent(tx, other, source, IP);
			if (typeof first === 'string' || typeof second === 'string') throw new Error('refused');
			const original = (await getEvent(tx, source))!;
			expect(await getEvent(tx, first.id)).toMatchObject({
				slug: `${s}-copy`,
				title: original.title,
				startsAt: original.startsAt,
				priceAmountMinor: 5000,
				city: 'Yerevan',
				status: 'draft',
				publishedAt: null,
				createdBy: other.id
			});
			expect((await getEvent(tx, second.id))?.slug).toBe(`${s}-copy-2`);
			expect(await listEventCategories(tx, first.id)).toMatchObject([
				{
					name: { en: 'Kids' },
					discipline: 'speed',
					ageMin: 8,
					ageMax: 12,
					capacity: 10,
					sortOrder: 1
				}
			]);
			expect(await listEventCategories(tx, source)).toHaveLength(1);
			const [entry] = await auditOf(tx, first.id);
			expect(entry).toMatchObject({ action: 'event.create', after: { duplicatedFrom: source } });
		});
	});

	it('delete is soft: row and categories stay, hidden from the admin, logged', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx);
			const id = await created(tx, actor, values(slug()));
			await createEventCategory(
				tx,
				actor,
				id,
				{
					name: { en: 'All' },
					discipline: 'other',
					ageMin: null,
					ageMax: null,
					capacity: null,
					sortOrder: 0
				},
				IP
			);
			expect(await deleteEvent(tx, actor, id, IP)).toBe('ok');
			const [row] = await tx.select().from(events).where(eq(events.id, id));
			expect(row.deletedAt).not.toBeNull();
			expect(
				await tx.select().from(eventCategories).where(eq(eventCategories.eventId, id))
			).toHaveLength(1);
			expect(await getEvent(tx, id)).toBeNull();
			expect(await deleteEvent(tx, actor, id, IP)).toBe('not_found');
			expect(await updateEvent(tx, actor, id, values(slug()), IP)).toBe('not_found');
			expect(await changeEventStatus(tx, actor, id, 'publish', IP)).toBe('not_found');
			expect(await duplicateEvent(tx, actor, id, IP)).toBe('not_found');
			const [entry] = (await auditOf(tx, id)).filter((e) => e.action === 'event.delete');
			expect(entry).toMatchObject({ actorId: actor.id, before: { status: 'draft' } });
		});
	});

	it('moderator and member change nothing', async () => {
		await inRollback(async (tx) => {
			const id = await created(tx, await staff(tx), values(slug()));
			for (const role of ['moderator', 'member'] as const) {
				const actor = await staff(tx, role);
				expect(await createEvent(tx, actor, values(slug()), IP)).toBe('not_allowed');
				expect(await updateEvent(tx, actor, id, values(slug()), IP)).toBe('not_allowed');
				expect(await changeEventStatus(tx, actor, id, 'publish', IP)).toBe('not_allowed');
				expect(await cancelEvent(tx, actor, id, 'x', IP)).toBe('not_allowed');
				expect(await duplicateEvent(tx, actor, id, IP)).toBe('not_allowed');
				expect(await deleteEvent(tx, actor, id, IP)).toBe('not_allowed');
			}
			expect((await auditOf(tx, id)).map((e) => e.action)).toEqual(['event.create']);
		});
	});

	it('the database refuses an end before the start', async () => {
		await inRollback(async (tx) => {
			const start = new Date(Date.now() + DAY);
			const insert = tx.transaction((sp) =>
				sp.insert(events).values({
					slug: slug(),
					title: { en: 'Bad' },
					startsAt: start,
					endsAt: new Date(start.getTime() - 1000)
				})
			);
			await expect(insert).rejects.toThrow();
			await tx.execute(sql`select 1`);
		});
	});

	it('unknown or malformed id is not found', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx, 'admin');
			expect(await updateEvent(tx, actor, 'nope', values(slug()), IP)).toBe('not_found');
			expect(await cancelEvent(tx, actor, crypto.randomUUID(), 'x', IP)).toBe('not_found');
			expect(await getEvent(tx, 'nope')).toBeNull();
		});
	});
});
