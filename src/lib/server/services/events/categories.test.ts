import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { EventCategoryValues } from '#lib/validation/events.ts';
import type { LimitDb } from '../../auth/rate-limit';
import type { UserRole } from '../../auth/session';
import { events } from '../../db/schema/events';
import { auditLog } from '../../db/schema/service';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import {
	createEventCategory,
	deleteEventCategory,
	listEventCategories,
	updateEventCategory
} from './categories';

const IP = '198.51.100.7';
const category = (extra: Partial<EventCategoryValues> = {}): EventCategoryValues => ({
	name: { en: 'Speed, 12–14' },
	discipline: 'speed',
	ageMin: 12,
	ageMax: 14,
	capacity: 20,
	sortOrder: 0,
	...extra
});

describe.skipIf(!testDbUrl)('events: categories tab (docs/05 section 5)', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	const staff = async (tx: LimitDb, role: UserRole = 'editor') => ({
		id: (await insertUser(tx, { role })).id,
		role
	});
	const addEvent = async (tx: LimitDb, deleted = false) => {
		const [row] = await tx
			.insert(events)
			.values({
				slug: `t-${crypto.randomUUID().slice(0, 8)}`,
				title: { en: 'Jam' },
				startsAt: new Date(Date.now() + 86_400_000),
				endsAt: new Date(Date.now() + 90_000_000),
				deletedAt: deleted ? new Date() : null
			})
			.returning({ id: events.id });
		return row.id;
	};
	const created = async (
		tx: LimitDb,
		actor: { id: string; role: UserRole },
		eventId: string,
		v: EventCategoryValues
	) => {
		const result = await createEventCategory(tx, actor, eventId, v, IP);
		if (typeof result === 'string') throw new Error(result);
		return result.id;
	};
	const auditOf = (tx: LimitDb, id: string) =>
		tx.select().from(auditLog).where(eq(auditLog.entityId, id));

	it('add, list by order, edit and delete; every change is logged', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx);
			const eventId = await addEvent(tx);
			const second = await created(tx, actor, eventId, category({ sortOrder: 2 }));
			const first = await created(
				tx,
				actor,
				eventId,
				category({ name: { en: 'Kids' }, discipline: 'style', ageMin: 8, ageMax: 11, sortOrder: 1 })
			);
			expect((await listEventCategories(tx, eventId)).map((c) => c.id)).toEqual([first, second]);
			expect((await auditOf(tx, second))[0]).toMatchObject({
				action: 'event_category.create',
				actorId: actor.id,
				entityType: 'event_category',
				after: { eventId, name: { en: 'Speed, 12–14' }, discipline: 'speed' },
				ip: IP
			});

			const next = category({ name: { en: 'Speed, 12–15' }, ageMax: 15, capacity: null });
			expect(await updateEventCategory(tx, actor, eventId, second, next, IP)).toBe('ok');
			expect((await listEventCategories(tx, eventId))[1]).toMatchObject({ id: second, ...next });
			const [update] = (await auditOf(tx, second)).filter(
				(e) => e.action === 'event_category.update'
			);
			expect(update).toMatchObject({
				before: { name: { en: 'Speed, 12–14' }, ageMax: 14, capacity: 20 },
				after: { name: { en: 'Speed, 12–15' }, ageMax: 15, capacity: null }
			});

			expect(await deleteEventCategory(tx, actor, eventId, first, IP)).toBe('ok');
			expect((await listEventCategories(tx, eventId)).map((c) => c.id)).toEqual([second]);
			expect((await auditOf(tx, first)).map((e) => e.action).sort()).toEqual([
				'event_category.create',
				'event_category.delete'
			]);
		});
	});

	it('a category of another event, or of a deleted event, is not found', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx, 'admin');
			const eventId = await addEvent(tx);
			const otherEvent = await addEvent(tx);
			const id = await created(tx, actor, eventId, category());
			expect(await updateEventCategory(tx, actor, otherEvent, id, category(), IP)).toBe(
				'not_found'
			);
			expect(await deleteEventCategory(tx, actor, otherEvent, id, IP)).toBe('not_found');
			expect(await deleteEventCategory(tx, actor, eventId, 'nope', IP)).toBe('not_found');
			const gone = await addEvent(tx, true);
			expect(await createEventCategory(tx, actor, gone, category(), IP)).toBe('not_found');
			expect(await createEventCategory(tx, actor, 'nope', category(), IP)).toBe('not_found');
			expect(await listEventCategories(tx, eventId)).toHaveLength(1);
		});
	});

	it('moderator and member change nothing', async () => {
		await inRollback(async (tx) => {
			const eventId = await addEvent(tx);
			const id = await created(tx, await staff(tx), eventId, category());
			for (const role of ['moderator', 'member'] as const) {
				const actor = await staff(tx, role);
				expect(await createEventCategory(tx, actor, eventId, category(), IP)).toBe('not_allowed');
				expect(await updateEventCategory(tx, actor, eventId, id, category(), IP)).toBe(
					'not_allowed'
				);
				expect(await deleteEventCategory(tx, actor, eventId, id, IP)).toBe('not_allowed');
			}
			expect(await listEventCategories(tx, eventId)).toHaveLength(1);
		});
	});
});
