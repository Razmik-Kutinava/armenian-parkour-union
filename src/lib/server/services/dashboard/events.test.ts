import { afterAll, describe, expect, it } from 'vitest';
import type { UserRole } from '../../auth/session';
import { heroBlocks } from '../../db/schema/hero';
import { eventRegistrations } from '../../db/schema/registrations';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { insertEvent } from '../registrations/test-support';
import { heroNow, upcomingEvents } from './events';

/* docs/05 section 3: "Upcoming events" for every role — three nearest published ones that have not
 * ended, with seats and the limit; "Home page now" — the hero blocks shown on the home page. */

const actor = (role: UserRole) => ({ id: crypto.randomUUID(), role });
const SOON = 60_000;

describe.skipIf(!testDbUrl)('dashboard: upcoming events', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('the nearest live event first, with seats, waitlist and limit; three at most', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx, { startsAt: new Date(Date.now() + SOON), capacity: 1 });
			const [a, b] = [await insertUser(tx), await insertUser(tx)];
			await tx.insert(eventRegistrations).values([
				{ eventId: event.id, userId: a.id, status: 'registered' },
				{ eventId: event.id, userId: b.id, status: 'waitlist' }
			]);
			const list = await upcomingEvents(tx, actor('moderator'));
			expect(list.length).toBeLessThanOrEqual(3);
			expect(list[0]).toMatchObject({
				id: event.id,
				title: { en: 'Spring jam', ru: 'Весенний джем' },
				capacity: 1,
				seats: 1,
				waitlist: 1,
				href: `/admin/registrations/${event.id}`
			});
		});
	});

	it('a draft, cancelled, deleted or ended event is not shown', async () => {
		await inRollback(async (tx) => {
			const startsAt = new Date(Date.now() + SOON);
			const hidden = [
				await insertEvent(tx, { startsAt, status: 'draft' }),
				await insertEvent(tx, { startsAt, status: 'cancelled' }),
				await insertEvent(tx, { startsAt, deletedAt: new Date() }),
				await insertEvent(tx, {
					startsAt: new Date(Date.now() - 3 * SOON),
					endsAt: new Date(Date.now() - SOON)
				})
			].map((e) => e.id);
			const ids = (await upcomingEvents(tx, actor('admin'))).map((e) => e.id);
			expect(ids.filter((id) => hidden.includes(id))).toEqual([]);
		});
	});

	it('the link: registrations for moderator and admin, the event form for editor', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx, { startsAt: new Date(Date.now() + SOON) });
			const [first] = await upcomingEvents(tx, actor('editor'));
			expect(first).toMatchObject({ id: event.id, href: `/admin/events/${event.id}` });
		});
	});
});

describe.skipIf(!testDbUrl)('dashboard: home page now', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('an active block on the home page is listed, an inactive one is not', async () => {
		await inRollback(async (tx) => {
			const [shown, off] = await tx
				.insert(heroBlocks)
				.values([
					{ type: 'custom', title: { en: 'Dash on' }, isActive: true, sortOrder: -100_000 },
					{ type: 'custom', title: { en: 'Dash off' }, isActive: false, sortOrder: -100_001 }
				])
				.returning();
			const list = await heroNow(tx);
			expect(list[0]).toEqual({ id: shown.id, type: 'custom', title: { en: 'Dash on' } });
			expect(list.map((b) => b.id)).not.toContain(off.id);
		});
	});
});
