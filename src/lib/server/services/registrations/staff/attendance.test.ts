import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { events } from '../../../db/schema/events';
import { eventRegistrations } from '../../../db/schema/registrations';
import { insertUser, testDb, testDbUrl } from '../../../db/test-db';
import { auditFor } from '../../memberships/test-support';
import { YEREVAN_OFFSET } from '../admission';
import {
	DAY,
	HOUR,
	insertEvent,
	insertMember,
	registerOk as register,
	registrationOf
} from '../test-support';
import { markAttendance } from './attendance';

/* docs/05 section 5 "Event day", docs/03 section 7.6: one tap marks "came" or "did not come";
 * from the event's calendar day in Yerevan, on a published or finished event. */

const IP = '198.51.100.7';
type Tx = Parameters<typeof insertUser>[0];
const staff = async (tx: Tx, role: 'moderator' | 'admin' | 'editor' = 'moderator') => ({
	id: (await insertUser(tx, { role })).id,
	role
});

/** 14:00 in Yerevan, ten days ahead; `dayStart` — 00:00 of that day in Yerevan. */
function eventDay() {
	const local = Date.now() + 10 * DAY + YEREVAN_OFFSET;
	const dayStart = local - (local % DAY) - YEREVAN_OFFSET;
	return { dayStart, startsAt: new Date(dayStart + 14 * HOUR) };
}

async function setup(tx: Tx) {
	const { dayStart, startsAt } = eventDay();
	const event = await insertEvent(tx, { startsAt });
	const member = await insertMember(tx);
	const registration = await register(tx, member.id, event.id);
	return { event, member, registration, onTheDay: new Date(dayStart + 30 * 60_000), dayStart };
}

describe.skipIf(!testDbUrl)('registrations staff: event day attendance', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('"came" on the day: attended with the time, logged; the same tap again writes nothing', async () => {
		await inRollback(async (tx) => {
			const { event, registration, onTheDay } = await setup(tx);
			const moderator = await staff(tx);
			const input = { eventId: event.id, registrationId: registration.id, came: true };

			expect(await markAttendance(tx, moderator, input, IP, onTheDay)).toBe('ok');
			const row = await registrationOf(tx, registration.id);
			expect(row.status).toBe('attended');
			expect(row.attendedAt?.getTime()).toBe(onTheDay.getTime());
			expect(await auditFor(tx, 'registration', registration.id)).toMatchObject([
				{
					action: 'registration.attendance',
					actorId: moderator.id,
					before: { status: 'registered' },
					after: { status: 'attended', eventId: event.id }
				}
			]);

			expect(await markAttendance(tx, moderator, input, IP, onTheDay)).toBe('ok');
			expect(await auditFor(tx, 'registration', registration.id)).toHaveLength(1);
		});
	});

	it('"did not come" and back: no_show clears the time, a fix to attended works', async () => {
		await inRollback(async (tx) => {
			const { event, registration, onTheDay } = await setup(tx);
			const admin = await staff(tx, 'admin');
			const ref = { eventId: event.id, registrationId: registration.id };
			await markAttendance(tx, admin, { ...ref, came: true }, IP, onTheDay);

			expect(await markAttendance(tx, admin, { ...ref, came: false }, IP, onTheDay)).toBe('ok');
			expect(await registrationOf(tx, registration.id)).toMatchObject({
				status: 'no_show',
				attendedAt: null
			});
			expect(await markAttendance(tx, admin, { ...ref, came: true }, IP, onTheDay)).toBe('ok');
			expect((await registrationOf(tx, registration.id)).status).toBe('attended');
			expect(await auditFor(tx, 'registration', registration.id)).toHaveLength(3);
		});
	});

	it('a finished event still takes marks (fixes after the end)', async () => {
		await inRollback(async (tx) => {
			const { event, registration, onTheDay } = await setup(tx);
			await tx.update(events).set({ status: 'finished' }).where(eq(events.id, event.id));
			const input = { eventId: event.id, registrationId: registration.id, came: false };
			expect(await markAttendance(tx, await staff(tx), input, IP, onTheDay)).toBe('ok');
			expect((await registrationOf(tx, registration.id)).status).toBe('no_show');
		});
	});

	it('before the event day, a closed event, a wrong status, an editor — refused, nothing written', async () => {
		await inRollback(async (tx) => {
			const { event, registration, onTheDay, dayStart } = await setup(tx);
			const moderator = await staff(tx);
			const input = { eventId: event.id, registrationId: registration.id, came: true };
			const run = (actor = moderator, data = input, now = onTheDay) =>
				markAttendance(tx, actor, data, IP, now);

			expect(await run(moderator, input, new Date(dayStart - 60_000))).toBe('too_early');
			expect(await run(await staff(tx, 'editor'))).toBe('not_allowed');
			expect(await run(moderator, { ...input, eventId: crypto.randomUUID() })).toBe('not_found');
			for (const status of ['waitlist', 'pending_payment', 'cancelled'] as const) {
				await tx
					.update(eventRegistrations)
					.set({ status })
					.where(eq(eventRegistrations.id, registration.id));
				expect(await run(), status).toBe('wrong_status');
			}
			await tx
				.update(eventRegistrations)
				.set({ status: 'registered' })
				.where(eq(eventRegistrations.id, registration.id));
			for (const status of ['draft', 'cancelled', 'archived'] as const) {
				await tx.update(events).set({ status }).where(eq(events.id, event.id));
				expect(await run(), status).toBe('event_closed');
			}
			expect((await registrationOf(tx, registration.id)).status).toBe('registered');
			expect(await auditFor(tx, 'registration', registration.id)).toEqual([]);
		});
	});
});
