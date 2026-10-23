import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { events } from '../../db/schema/events';
import { eventRegistrations } from '../../db/schema/registrations';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { balanceOf, setRules } from '../points/test-support';
import { markAttendance } from './staff/attendance';
import { saveResults } from './staff/results';
import { insertEvent, insertMember, registerOk as register } from './test-support';

/* docs/03 sections 6.1-6.2, 7.6-7.7 on the event day and results screens: "came" earns
 * participation once; place 1-3 earns its points once; "did not come" earns nothing and does not
 * take back what was paid (fixed by hand, like a changed place). */

const IP = '198.51.100.7';
type Tx = Parameters<typeof setRules>[0];
const RULES = {
	event_registration: { points: 5 },
	event_participation: { points: 20 },
	event_place_1: { points: 50 },
	event_place_2: { points: 30 }
};
const moderatorOf = async (tx: Tx) => ({
	id: (await insertUser(tx, { role: 'moderator' })).id,
	role: 'moderator' as const
});

/** A started event (the marks are open), its member registered before the start. */
async function started(tx: Tx) {
	const event = await insertEvent(tx);
	const member = await insertMember(tx);
	const { id } = await register(tx, member.id, event.id);
	await tx
		.update(events)
		.set({ startsAt: new Date(Date.now() - 3_600_000) })
		.where(eq(events.id, event.id));
	return { event, member, ref: { eventId: event.id, registrationId: id } };
}

describe.skipIf(!testDbUrl)('registrations: points on the event day and results', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('"came": participation once; taps again and no-show-then-came add nothing', async () => {
		await inRollback(async (tx) => {
			await setRules(tx, RULES);
			const { member, ref } = await started(tx);
			const moderator = await moderatorOf(tx);
			const mark = (came: boolean) => markAttendance(tx, moderator, { ...ref, came }, IP);

			expect(await mark(true)).toBe('ok');
			expect(await balanceOf(tx, member.id)).toBe(25);
			await mark(true);
			expect(await mark(false)).toBe('ok');
			expect(await balanceOf(tx, member.id)).toBe(25);
			await mark(true);
			expect(await balanceOf(tx, member.id)).toBe(25);
		});
	});

	it('"did not come" first: no participation points', async () => {
		await inRollback(async (tx) => {
			await setRules(tx, RULES);
			const { member, ref } = await started(tx);
			expect(await markAttendance(tx, await moderatorOf(tx), { ...ref, came: false }, IP)).toBe(
				'ok'
			);
			expect(await balanceOf(tx, member.id)).toBe(5);
		});
	});

	it('the winner: place 1 adds 50 once; a later place change pays nothing more', async () => {
		await inRollback(async (tx) => {
			await setRules(tx, RULES);
			const { event, member, ref } = await started(tx);
			const moderator = await moderatorOf(tx);
			await markAttendance(tx, moderator, { ...ref, came: true }, IP);
			const save = (place: string) =>
				saveResults(
					tx,
					moderator,
					{ eventId: event.id, rows: [{ registrationId: ref.registrationId, place, score: '' }] },
					IP
				);

			expect(await save('1')).toBe('ok');
			expect(await balanceOf(tx, member.id)).toBe(75);
			expect(await save('1')).toBe('ok');
			expect(await save('2')).toBe('ok');
			expect(await balanceOf(tx, member.id)).toBe(75);
		});
	});

	it('a place saved before "came" (fixed later): the place points come with the mark', async () => {
		await inRollback(async (tx) => {
			await setRules(tx, RULES);
			const { member, ref } = await started(tx);
			const moderator = await moderatorOf(tx);
			await markAttendance(tx, moderator, { ...ref, came: true }, IP);
			await markAttendance(tx, moderator, { ...ref, came: false }, IP);
			await tx
				.update(eventRegistrations)
				.set({ place: 2 })
				.where(eq(eventRegistrations.id, ref.registrationId));
			await markAttendance(tx, moderator, { ...ref, came: true }, IP);
			expect(await balanceOf(tx, member.id)).toBe(55);
		});
	});
});
