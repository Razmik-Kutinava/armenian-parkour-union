import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { consents } from '../../../db/schema/consents';
import { events } from '../../../db/schema/events';
import { memberships } from '../../../db/schema/payments';
import { insertUser, testDb, testDbUrl } from '../../../db/test-db';
import { daysFromNow, insertConsent } from '../../consents/test-support';
import { auditFor } from '../../memberships/test-support';
import { paidEvent } from '../pay-support';
import {
	HOUR,
	bornBefore,
	cancelDeps,
	insertCategory,
	insertEvent,
	insertMember,
	mailbox,
	registerOk as register,
	registrationOf
} from '../test-support';
import { promoteRegistration } from './promote';

/* docs/05 section 5, docs/04 section 3: staff move a registration from the waitlist by hand —
 * only onto a free seat; a paid event gives the member `offer_hours` to pay and a letter. */

const IP = '198.51.100.7';
type Tx = Parameters<typeof insertUser>[0];
const staff = async (tx: Tx, role: 'moderator' | 'admin' | 'editor' = 'moderator') => ({
	id: (await insertUser(tx, { role })).id,
	role
});
const capacity = (tx: Tx, id: string, value: number) =>
	tx.update(events).set({ capacity: value }).where(eq(events.id, id));

describe.skipIf(!testDbUrl)('registrations staff: move from the waitlist', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('free event: the limit raised — the queued member takes the seat; the log keeps it', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx, { capacity: 1 });
			await register(tx, (await insertMember(tx)).id, event.id);
			const queued = await register(tx, (await insertMember(tx)).id, event.id);
			expect(queued.status).toBe('waitlist');
			await capacity(tx, event.id, 2);
			const moderator = await staff(tx);
			const input = { eventId: event.id, registrationId: queued.id };

			expect(await promoteRegistration(tx, moderator, input, cancelDeps(), IP)).toBe('ok');
			expect(await registrationOf(tx, queued.id)).toMatchObject({
				status: 'registered',
				holdUntil: null
			});
			const [entry] = await auditFor(tx, 'registration', queued.id);
			expect(entry).toMatchObject({
				action: 'registration.promote',
				actorId: moderator.id,
				before: { status: 'waitlist' },
				after: { status: 'registered', eventId: event.id }
			});
		});
	});

	it('paid event: the seat is held for offer_hours and the member gets a letter', async () => {
		await inRollback(async (tx) => {
			const event = await paidEvent(tx, { capacity: 1 });
			await register(tx, (await insertMember(tx)).id, event.id);
			const member = await insertMember(tx);
			const queued = await register(tx, member.id, event.id);
			await capacity(tx, event.id, 2);
			const box = mailbox();
			const input = { eventId: event.id, registrationId: queued.id };

			expect(await promoteRegistration(tx, await staff(tx), input, cancelDeps(box), IP)).toBe('ok');
			const row = await registrationOf(tx, queued.id);
			expect(row.status).toBe('pending_payment');
			const offer = row.holdUntil!.getTime() - Date.now();
			expect(offer).toBeGreaterThan(47 * HOUR);
			expect(offer).toBeLessThanOrEqual(48 * HOUR);
			expect(box.sent.map((m) => m.to)).toEqual([member.email]);
		});
	});

	it('no free seat in the event or the category — refused, nothing changes', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx, { capacity: 1 });
			await register(tx, (await insertMember(tx)).id, event.id);
			const queued = await register(tx, (await insertMember(tx)).id, event.id);
			const input = { eventId: event.id, registrationId: queued.id };
			expect(await promoteRegistration(tx, await staff(tx), input, cancelDeps(), IP)).toBe('full');

			const open = await insertEvent(tx);
			const category = await insertCategory(tx, open.id, { capacity: 1 });
			await register(tx, (await insertMember(tx)).id, open.id, category.id);
			const inLine = await register(tx, (await insertMember(tx)).id, open.id, category.id);
			const second = { eventId: open.id, registrationId: inLine.id };
			expect(await promoteRegistration(tx, await staff(tx), second, cancelDeps(), IP)).toBe('full');
			expect((await registrationOf(tx, queued.id)).status).toBe('waitlist');
			expect((await registrationOf(tx, inLine.id)).status).toBe('waitlist');
			expect(await auditFor(tx, 'registration', queued.id)).toEqual([]);
		});
	});

	it('a member who would not be admitted now — refused with the reason, nothing changes', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx, { capacity: 1 });
			await register(tx, (await insertMember(tx)).id, event.id);
			const minor = await insertMember(tx, { birthDate: bornBefore(15) });
			const consent = await insertConsent(tx, minor.id, {
				status: 'approved',
				validUntil: daysFromNow(30)
			});
			const child = await register(tx, minor.id, event.id);
			const lapsed = await insertMember(tx);
			const late = await register(tx, lapsed.id, event.id);
			await tx.update(consents).set({ status: 'expired' }).where(eq(consents.id, consent.id));
			await tx
				.update(memberships)
				.set({ endsAt: new Date(Date.now() - HOUR) })
				.where(eq(memberships.userId, lapsed.id));
			await capacity(tx, event.id, 3);
			const moderator = await staff(tx);
			const box = mailbox();

			const first = { eventId: event.id, registrationId: child.id };
			expect(await promoteRegistration(tx, moderator, first, cancelDeps(box), IP)).toBe(
				'parental_consent'
			);
			const second = { eventId: event.id, registrationId: late.id };
			expect(await promoteRegistration(tx, moderator, second, cancelDeps(box), IP)).toBe(
				'no_membership'
			);
			expect((await registrationOf(tx, child.id)).status).toBe('waitlist');
			expect((await registrationOf(tx, late.id)).status).toBe('waitlist');
			expect(await auditFor(tx, 'registration', child.id)).toEqual([]);
			expect(box.sent).toEqual([]);
		});
	});

	it('not in the waitlist, another event, a closed event or an editor — refused', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx);
			const active = await register(tx, (await insertMember(tx)).id, event.id);
			const moderator = await staff(tx);
			const own = { eventId: event.id, registrationId: active.id };
			expect(await promoteRegistration(tx, moderator, own, cancelDeps(), IP)).toBe('wrong_status');

			const other = await insertEvent(tx);
			const foreign = { eventId: other.id, registrationId: active.id };
			expect(await promoteRegistration(tx, moderator, foreign, cancelDeps(), IP)).toBe('not_found');
			const bad = { eventId: event.id, registrationId: 'nope' };
			expect(await promoteRegistration(tx, moderator, bad, cancelDeps(), IP)).toBe('not_found');

			const full = await insertEvent(tx, { capacity: 1 });
			await register(tx, (await insertMember(tx)).id, full.id);
			const queued = await register(tx, (await insertMember(tx)).id, full.id);
			await tx
				.update(events)
				.set({ status: 'finished', capacity: 5 })
				.where(eq(events.id, full.id));
			const late = { eventId: full.id, registrationId: queued.id };
			expect(await promoteRegistration(tx, moderator, late, cancelDeps(), IP)).toBe('event_closed');
			await tx.update(events).set({ status: 'published' }).where(eq(events.id, full.id));
			const editor = await staff(tx, 'editor');
			expect(await promoteRegistration(tx, editor, late, cancelDeps(), IP)).toBe('not_allowed');
			expect((await registrationOf(tx, queued.id)).status).toBe('waitlist');
		});
	});
});
