import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { events } from '../../../db/schema/events';
import { eventRegistrations } from '../../../db/schema/registrations';
import { insertUser, testDb, testDbUrl } from '../../../db/test-db';
import { auditFor } from '../../memberships/test-support';
import { createMockProvider } from '../../payments/providers/mock';
import { paymentRow } from '../../payments/test-support';
import { feeEffects, paidEvent, payStarted, settleFee } from '../pay-support';
import {
	SETTINGS,
	cancelDeps,
	insertEvent,
	insertMember,
	mailbox,
	registerOk as register,
	registrationOf
} from '../test-support';
import { cancelRegistrationByStaff } from './cancel';

/* docs/05 section 5: staff cancel a registration with a reason — no member deadline; the freed seat
 * goes to the waitlist; a paid fee goes to an admin (docs/03 section 7.5, 7.8). */

const IP = '198.51.100.7';
type Tx = Parameters<typeof insertUser>[0];
const staff = async (tx: Tx, role: 'moderator' | 'admin' | 'editor' = 'moderator') => ({
	id: (await insertUser(tx, { role })).id,
	role
});
const input = (eventId: string, registrationId: string) => ({
	eventId,
	registrationId,
	reason: 'Asked by phone'
});

describe.skipIf(!testDbUrl)('registrations staff: cancel a registration', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('the seat goes to the first in line with a letter, past the member deadline; logged', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx, { capacity: 1 });
			const member = await insertMember(tx);
			const active = await register(tx, member.id, event.id);
			const next = await insertMember(tx);
			const queued = await register(tx, next.id, event.id);
			const box = mailbox();
			const deps = cancelDeps(box, { ...SETTINGS, cancelHours: 10_000 });
			const moderator = await staff(tx);

			const result = await cancelRegistrationByStaff(
				tx,
				moderator,
				input(event.id, active.id),
				deps,
				IP
			);
			expect(result).toBe('ok');
			expect(await registrationOf(tx, active.id)).toMatchObject({ status: 'cancelled' });
			expect((await registrationOf(tx, queued.id)).status).toBe('registered');
			expect(box.sent.map((m) => m.to)).toEqual([member.email, next.email]);
			const [entry] = await auditFor(tx, 'registration', active.id);
			expect(entry).toMatchObject({
				action: 'registration.cancel',
				actorId: moderator.id,
				before: { status: 'registered' },
				after: { status: 'cancelled', reason: 'Asked by phone', eventId: event.id }
			});
		});
	});

	it('a waiting payment is cancelled, a paid one goes to review', async () => {
		await inRollback(async (tx) => {
			const mock = createMockProvider();
			const event = await paidEvent(tx);
			const paid = await payStarted(tx, mock, event.id);
			await settleFee(tx, mock, paid.payment.id, 'paid', feeEffects());
			const unpaid = await payStarted(tx, mock, event.id);
			const admin = await staff(tx, 'admin');

			for (const id of [paid.registrationId, unpaid.registrationId]) {
				expect(
					await cancelRegistrationByStaff(tx, admin, input(event.id, id), cancelDeps(), IP)
				).toBe('ok');
			}
			expect(await paymentRow(tx, unpaid.payment.id)).toMatchObject({
				status: 'cancelled',
				failureReason: 'registration_cancelled'
			});
			expect(await paymentRow(tx, paid.payment.id)).toMatchObject({
				status: 'paid',
				needsReview: true
			});
			const review = (await auditFor(tx, 'payment', paid.payment.id)).find(
				(e) => e.action === 'event_fee.review'
			);
			expect(review?.after).toMatchObject({
				reason: 'cancelled_by_staff',
				registrationId: paid.registrationId
			});
		});
	});

	it('attended, a closed event, another event, an editor or no reason — refused', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx);
			const came = await register(tx, (await insertMember(tx)).id, event.id);
			await tx
				.update(eventRegistrations)
				.set({ status: 'attended' })
				.where(eq(eventRegistrations.id, came.id));
			const moderator = await staff(tx);
			const run = (actor: typeof moderator, data: ReturnType<typeof input>) =>
				cancelRegistrationByStaff(tx, actor, data, cancelDeps(), IP);
			expect(await run(moderator, input(event.id, came.id))).toBe('wrong_status');

			const active = await register(tx, (await insertMember(tx)).id, event.id);
			expect(await run(await staff(tx, 'editor'), input(event.id, active.id))).toBe('not_allowed');
			expect(await run(moderator, { ...input(event.id, active.id), reason: '  ' })).toBe(
				'no_reason'
			);
			expect(await run(moderator, input(crypto.randomUUID(), active.id))).toBe('not_found');
			await tx.update(events).set({ status: 'finished' }).where(eq(events.id, event.id));
			expect(await run(moderator, input(event.id, active.id))).toBe('event_closed');
			expect((await registrationOf(tx, active.id)).status).toBe('registered');
			expect(await auditFor(tx, 'registration', active.id)).toEqual([]);
		});
	});
});
