import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { events } from '../../db/schema/events';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { balanceOf, ledgerOf, setRules } from '../points/test-support';
import { addRegistration } from './staff/add';
import { cancelRegistrationByStaff } from './staff/cancel';
import { promoteRegistration } from './staff/promote';
import { cancelDeps, insertEvent, insertMember, registerOk as register } from './test-support';

/* docs/03 section 6.2 p. 5-6 for staff actions: a site registration moved from the waitlist
 * earns the registration points; a cancel before the start takes them back; a member added by
 * hand gets none. */

const IP = '198.51.100.7';
type Tx = Parameters<typeof setRules>[0];
const rules = (tx: Tx) => setRules(tx, { event_registration: { points: 5 } });
const moderatorOf = async (tx: Tx) => ({
	id: (await insertUser(tx, { role: 'moderator' })).id,
	role: 'moderator' as const
});

describe.skipIf(!testDbUrl)('registrations: points on staff actions', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('moved from the waitlist onto a free seat: the registration points once', async () => {
		await inRollback(async (tx) => {
			await rules(tx);
			const event = await insertEvent(tx, { capacity: 1 });
			await register(tx, (await insertMember(tx)).id, event.id);
			const member = await insertMember(tx);
			const queued = await register(tx, member.id, event.id);
			await tx.update(events).set({ capacity: 2 }).where(eq(events.id, event.id));
			const input = { eventId: event.id, registrationId: queued.id };
			expect(await promoteRegistration(tx, await moderatorOf(tx), input, cancelDeps(), IP)).toBe(
				'ok'
			);
			expect(await balanceOf(tx, member.id)).toBe(5);
		});
	});

	it('cancelled by staff before the start: a system reversal', async () => {
		await inRollback(async (tx) => {
			await rules(tx);
			const event = await insertEvent(tx);
			const member = await insertMember(tx);
			const { id } = await register(tx, member.id, event.id);
			const input = { eventId: event.id, registrationId: id, reason: 'Duplicate' };
			const moderator = await moderatorOf(tx);
			expect(await cancelRegistrationByStaff(tx, moderator, input, cancelDeps(), IP)).toBe('ok');
			const reversal = (await ledgerOf(tx, member.id)).find((e) => e.reason === 'reversal');
			expect(reversal).toMatchObject({ delta: -5, createdBy: null });
			expect(await balanceOf(tx, member.id)).toBe(0);
		});
	});

	it('added by hand: no registration points', async () => {
		await inRollback(async (tx) => {
			await rules(tx);
			const event = await insertEvent(tx);
			const member = await insertMember(tx);
			const input = { eventId: event.id, member: member.id, categoryId: null };
			expect(await addRegistration(tx, await moderatorOf(tx), input, IP)).toMatchObject({
				ok: true
			});
			expect(await ledgerOf(tx, member.id)).toEqual([]);
		});
	});
});
