import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { eventCategories, events } from '../../db/schema/events';
import { eventRegistrations } from '../../db/schema/registrations';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { auditFor } from '../memberships/test-support';
import {
	insertCategory,
	insertEvent,
	insertMember,
	registerOk as register
} from '../registrations/test-support';
import { deleteEventCategory } from './categories';
import { deleteEvent } from './lifecycle';

/* docs/03 section 7 p. 8, docs/05 section 5: a category or an event with registrations is not
 * deleted — a clear refusal instead of a database error; the event can only be cancelled. */

const IP = '198.51.100.7';

describe.skipIf(!testDbUrl)('events: delete refused with registrations', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a category with a registration (even a cancelled one) stays: in_use, nothing logged', async () => {
		await inRollback(async (tx) => {
			const editor = { id: (await insertUser(tx, { role: 'editor' })).id, role: 'editor' as const };
			const event = await insertEvent(tx);
			const category = await insertCategory(tx, event.id);
			const { id } = await register(tx, (await insertMember(tx)).id, event.id, category.id);
			await tx
				.update(eventRegistrations)
				.set({ status: 'cancelled' })
				.where(eq(eventRegistrations.id, id));
			expect(await deleteEventCategory(tx, editor, event.id, category.id, IP)).toBe('in_use');
			const [kept] = await tx
				.select()
				.from(eventCategories)
				.where(eq(eventCategories.id, category.id));
			expect(kept).toBeDefined();
			expect(await auditFor(tx, 'event_category', category.id)).toHaveLength(0);
		});
	});

	it('an event with a registration is not deleted: has_registrations, it stays on the site', async () => {
		await inRollback(async (tx) => {
			const editor = { id: (await insertUser(tx, { role: 'editor' })).id, role: 'editor' as const };
			const event = await insertEvent(tx);
			await register(tx, (await insertMember(tx)).id, event.id);
			expect(await deleteEvent(tx, editor, event.id, IP)).toBe('has_registrations');
			const [row] = await tx.select().from(events).where(eq(events.id, event.id));
			expect(row.deletedAt).toBeNull();
			expect(await auditFor(tx, 'event', event.id)).toHaveLength(0);
		});
	});
});
