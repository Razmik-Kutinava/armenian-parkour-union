import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { events } from '../../db/schema/events';
import { testDb, testDbUrl } from '../../db/test-db';
import { auditFor } from '../memberships/test-support';
import { createMockProvider } from '../payments/providers/mock';
import { paymentRow } from '../payments/test-support';
import { cancelRegistration } from './cancel';
import { feeEffects, paidEvent, payStarted, settleFee } from './pay-support';
import {
	HOUR,
	SETTINGS,
	cancelDeps as deps,
	insertEvent,
	insertMember,
	mailbox,
	registerOk as register,
	registrationOf
} from './test-support';

/* docs/03 section 7.5, docs/04 section 3.1: the member cancels their own registration before the
 * start; letters go after the commit (docs/03 section 14). */

describe.skipIf(!testDbUrl)('registrations: cancel', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('the member cancels their own registration', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx, { priceAmountMinor: 5000 });
			const member = await insertMember(tx);
			const { id } = await register(tx, member.id, event.id);
			expect(await cancelRegistration(tx, member.id, event.id, deps())).toBe('ok');
			expect(await registrationOf(tx, id)).toMatchObject({ status: 'cancelled', holdUntil: null });
			expect(await cancelRegistration(tx, member.id, event.id, deps())).toBe('wrong_status');
		});
	});

	it('no own registration — not found; someone else’s stays untouched', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx);
			const [owner, other] = [await insertMember(tx), await insertMember(tx)];
			const { id } = await register(tx, owner.id, event.id);
			expect(await cancelRegistration(tx, other.id, event.id, deps())).toBe('not_found');
			expect(await cancelRegistration(tx, owner.id, crypto.randomUUID(), deps())).toBe('not_found');
			expect(await cancelRegistration(tx, owner.id, 'nope', deps())).toBe('not_found');
			expect((await registrationOf(tx, id)).status).toBe('registered');
		});
	});

	it('after the start — too late; cancel_hours before the start — too late, the waitlist may leave', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx, {
				capacity: 1,
				startsAt: new Date(Date.now() + 10 * HOUR)
			});
			const [a, b] = [await insertMember(tx), await insertMember(tx)];
			const first = await register(tx, a.id, event.id);
			const queued = await register(tx, b.id, event.id);
			const strict = { ...SETTINGS, cancelHours: 24 };
			expect(await cancelRegistration(tx, a.id, event.id, deps(mailbox(), strict))).toBe(
				'too_late'
			);
			expect(await cancelRegistration(tx, b.id, event.id, deps(mailbox(), strict))).toBe('ok');
			expect((await registrationOf(tx, first.id)).status).toBe('registered');
			expect((await registrationOf(tx, queued.id)).status).toBe('cancelled');

			await tx
				.update(events)
				.set({ startsAt: new Date(Date.now() - HOUR) })
				.where(eq(events.id, event.id));
			expect(await cancelRegistration(tx, a.id, event.id, deps())).toBe('too_late');
		});
	});

	it('leaving the waitlist frees no seat: nobody moves, no letter', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx, { capacity: 1 });
			const [a, b, c] = [await insertMember(tx), await insertMember(tx), await insertMember(tx)];
			await register(tx, a.id, event.id);
			await register(tx, b.id, event.id);
			const last = await register(tx, c.id, event.id);
			const box = mailbox();
			expect(await cancelRegistration(tx, b.id, event.id, deps(box))).toBe('ok');
			expect((await registrationOf(tx, last.id)).status).toBe('waitlist');
			expect(box.sent).toHaveLength(0);
		});
	});

	it('a failed letter does not undo the cancel or the move', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx, { capacity: 1 });
			const [a, b] = [await insertMember(tx), await insertMember(tx)];
			const first = await register(tx, a.id, event.id);
			const queued = await register(tx, b.id, event.id);
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			expect(await cancelRegistration(tx, a.id, event.id, deps(mailbox(true)))).toBe('ok');
			expect(warn).toHaveBeenCalled();
			warn.mockRestore();
			expect((await registrationOf(tx, first.id)).status).toBe('cancelled');
			expect((await registrationOf(tx, queued.id)).status).toBe('registered');
		});
	});

	it('cancelled before paying: the waiting payment is cancelled too', async () => {
		await inRollback(async (tx) => {
			const event = await paidEvent(tx);
			const { member, payment } = await payStarted(tx, createMockProvider(), event.id);
			expect(await cancelRegistration(tx, member.id, event.id, deps())).toBe('ok');
			expect(await paymentRow(tx, payment.id)).toMatchObject({
				status: 'cancelled',
				failureReason: 'registration_cancelled'
			});
		});
	});

	it('cancelled after paying: the money stays, the payment goes to review (the admin decides)', async () => {
		await inRollback(async (tx) => {
			const mock = createMockProvider();
			const event = await paidEvent(tx);
			const { member, payment } = await payStarted(tx, mock, event.id);
			await settleFee(tx, mock, payment.id, 'paid', feeEffects());
			expect(await cancelRegistration(tx, member.id, event.id, deps())).toBe('ok');
			expect(await paymentRow(tx, payment.id)).toMatchObject({ status: 'paid', needsReview: true });
			const reviews = (await auditFor(tx, 'payment', payment.id)).filter(
				(e) => e.action === 'event_fee.review'
			);
			expect(reviews.map((e) => e.after)).toMatchObject([{ reason: 'cancelled_by_member' }]);
		});
	});
});
