import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { events } from '../../../db/schema/events';
import { insertUser, testDb, testDbUrl } from '../../../db/test-db';
import { auditFor } from '../../memberships/test-support';
import { paidEvent } from '../pay-support';
import {
	DAY,
	HOUR,
	bornBefore,
	cancelDeps,
	insertCategory,
	insertEvent,
	insertMember,
	registerOk as register,
	registrationOf,
	registrationsOf
} from '../test-support';
import { cancelRegistration } from '../cancel';
import { addRegistration } from './add';

/* docs/05 section 5: staff add a member by hand — past the registration window and the start
 * ("event day"); the other conditions of docs/03 section 7.2 hold; no payment, no points. */

const IP = '198.51.100.7';
type Tx = Parameters<typeof insertUser>[0];
const staff = async (tx: Tx, role: 'moderator' | 'admin' | 'editor' = 'moderator') => ({
	id: (await insertUser(tx, { role })).id,
	role
});

describe.skipIf(!testDbUrl)('registrations staff: add a member by hand', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('by email (any case) after the window closed and the start — registered, logged', async () => {
		await inRollback(async (tx) => {
			const event = await paidEvent(tx, {
				startsAt: new Date(Date.now() - HOUR),
				registrationClosesAt: new Date(Date.now() - DAY)
			});
			const member = await insertMember(tx);
			const moderator = await staff(tx);
			const result = await addRegistration(
				tx,
				moderator,
				{ eventId: event.id, member: member.email.toUpperCase(), categoryId: null },
				IP
			);
			expect(result).toMatchObject({ ok: true });
			if (!result.ok) return;
			expect(await registrationOf(tx, result.id)).toMatchObject({
				userId: member.id,
				status: 'registered',
				paymentId: null,
				holdUntil: null
			});
			const [entry] = await auditFor(tx, 'registration', result.id);
			expect(entry).toMatchObject({
				action: 'registration.add',
				actorId: moderator.id,
				after: { eventId: event.id, userId: member.id, categoryId: null, status: 'registered' }
			});
		});
	});

	it('by id; a cancelled row is reused; the category must fit the age', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx);
			const kids = await insertCategory(tx, event.id, { ageMax: 12 });
			const adults = await insertCategory(tx, event.id, { ageMin: 18 });
			const member = await insertMember(tx);
			const first = await register(tx, member.id, event.id, adults.id);
			expect(await cancelRegistration(tx, member.id, event.id, cancelDeps())).toBe('ok');
			const moderator = await staff(tx);
			const add = (categoryId: string | null) =>
				addRegistration(tx, moderator, { eventId: event.id, member: member.id, categoryId }, IP);

			expect(await add(null)).toEqual({ ok: false, reason: 'category_required' });
			expect(await add(kids.id)).toEqual({ ok: false, reason: 'age_mismatch' });
			expect(await add(adults.id)).toEqual({ ok: true, id: first.id });
			expect(await add(adults.id)).toEqual({ ok: false, reason: 'already_registered' });
			expect(await registrationsOf(tx, event.id)).toHaveLength(1);
		});
	});

	it('member conditions hold: membership, parental consent; no seat — refused', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx, { capacity: 1 });
			const moderator = await staff(tx);
			const add = (member: string) =>
				addRegistration(tx, moderator, { eventId: event.id, member, categoryId: null }, IP);
			const stranger = await insertUser(tx, { emailVerified: true });
			expect(await add(stranger.id)).toEqual({ ok: false, reason: 'no_membership' });
			const minor = await insertMember(tx, { birthDate: bornBefore(14) });
			expect(await add(minor.id)).toEqual({ ok: false, reason: 'parental_consent' });
			await register(tx, (await insertMember(tx)).id, event.id);
			expect(await add((await insertMember(tx)).id)).toEqual({ ok: false, reason: 'full' });
			expect(await registrationsOf(tx, event.id)).toHaveLength(1);
		});
	});

	it('unknown member, a draft or finished event, an editor — refused', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx);
			const member = await insertMember(tx);
			const moderator = await staff(tx);
			const add = (actor: typeof moderator, who = member.id) =>
				addRegistration(tx, actor, { eventId: event.id, member: who, categoryId: null }, IP);

			expect(await add(moderator, 'nobody@example.com')).toEqual({
				ok: false,
				reason: 'user_not_found'
			});
			expect(await add(await staff(tx, 'editor'))).toEqual({ ok: false, reason: 'not_allowed' });
			for (const status of ['draft', 'finished', 'cancelled'] as const) {
				await tx.update(events).set({ status }).where(eq(events.id, event.id));
				expect(await add(moderator)).toEqual({ ok: false, reason: 'event_closed' });
			}
			expect(await registrationsOf(tx, event.id)).toHaveLength(0);
		});
	});
});
