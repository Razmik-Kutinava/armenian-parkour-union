import { afterAll, describe, expect, it } from 'vitest';
import { testDb, testDbUrl } from '../../db/test-db';
import { paidEvent, payStarted } from '../registrations/pay-support';
import { releaseExpiredHolds } from '../registrations/release';
import { SEAT_STATUSES } from '../registrations/seats';
import {
	cancelDeps,
	insertMember,
	mailbox,
	registerOk,
	registrationOf,
	registrationsOf
} from '../registrations/test-support';
import { deliver, onlyProvider, productionEffects } from './acceptance-support';
import { refundPayment } from './admin/refund';
import { staff } from './admin/test-support';
import { createMockProvider } from './providers/mock';
import { reconcilePayments } from './reconcile';
import { later, ownMock } from './reconcile-support';
import { paymentForReturn } from './return';
import { paymentRow } from './test-support';

/* docs/07 section 15, the event fee chain on mock with the production effects: an expired payment
 * frees the seat, a late one never breaks the limit, a refund gives the seat to the waitlist. */

describe.skipIf(!testDbUrl)('payments acceptance: event fee', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a duplicate webhook: the registration counts once, no review', async () => {
		await inRollback(async (tx) => {
			const mock = createMockProvider();
			const { effects } = productionEffects();
			const event = await paidEvent(tx);
			const { registrationId, payment } = await payStarted(tx, mock, event.id);
			const paid = mock.simulate(payment.providerPaymentId!, 'paid');
			for (const notice of [paid, paid]) expect(await deliver(tx, mock, notice, effects)).toBe(200);
			expect(await paymentRow(tx, payment.id)).toMatchObject({
				status: 'paid',
				needsReview: false
			});
			expect((await registrationOf(tx, registrationId)).status).toBe('registered');
		});
	});

	it('a forged return to /payment/success: the registration still waits for the money', async () => {
		await inRollback(async (tx) => {
			const mock = createMockProvider();
			const { effects } = productionEffects();
			const event = await paidEvent(tx);
			const { registrationId, payment } = await payStarted(tx, mock, event.id);
			const deps = { providerOf: onlyProvider(mock), allowCheck: async () => true, effects };
			expect((await paymentForReturn(tx, payment.id, deps))?.status).toBe('pending');
			expect((await registrationOf(tx, registrationId)).status).toBe('pending_payment');
		});
	});

	it('expired: reconciliation cancels the payment, the seat goes to the waitlist; paying late then does not break the limit', async () => {
		await inRollback(async (tx) => {
			const { provider } = ownMock();
			const { effects } = productionEffects();
			const event = await paidEvent(tx, { capacity: 1 });
			const { registrationId, payment, member } = await payStarted(tx, provider, event.id);
			const queued = await insertMember(tx);
			const waiting = await registerOk(tx, queued.id, event.id);
			const now = later(35);

			const deps = { providerOf: onlyProvider(provider), now, effects };
			expect(await reconcilePayments(tx, deps)).toMatchObject({ expired: 1, failed: 0 });
			expect(await paymentRow(tx, payment.id)).toMatchObject({
				status: 'cancelled',
				failureReason: 'expired'
			});
			const box = mailbox();
			expect(await releaseExpiredHolds(tx, cancelDeps(box), now)).toBeGreaterThanOrEqual(1);
			expect((await registrationOf(tx, registrationId)).status).toBe('cancelled');
			expect((await registrationOf(tx, waiting.id)).status).toBe('pending_payment');
			const ours = [member.email, queued.email];
			expect(box.sent.map((m) => m.to).filter((to) => ours.includes(to))).toEqual(ours);

			const late = provider.simulate(payment.providerPaymentId!, 'paid');
			expect(await deliver(tx, provider, late, effects)).toBe(200);
			expect(await paymentRow(tx, payment.id)).toMatchObject({ status: 'paid', needsReview: true });
			expect((await registrationOf(tx, registrationId)).status).toBe('cancelled');
			const taken = (await registrationsOf(tx, event.id)).filter((r) =>
				SEAT_STATUSES.includes(r.status)
			);
			expect(taken).toHaveLength(1);
		});
	});

	it('a refund by the admin cancels the registration and moves the waitlist; the refund letter goes', async () => {
		await inRollback(async (tx) => {
			const mock = createMockProvider();
			const { sent, effects } = productionEffects();
			const event = await paidEvent(tx, { capacity: 1 });
			const { member, registrationId, payment } = await payStarted(tx, mock, event.id);
			await deliver(tx, mock, mock.simulate(payment.providerPaymentId!, 'paid'), effects);
			expect(sent.splice(0).map((m) => m.to)).toEqual([member.email]);
			const queued = await insertMember(tx);
			const waiting = await registerOk(tx, queued.id, event.id);
			const admin = await staff(tx);
			const deps = { effects, providerOf: onlyProvider(mock), ip: null };
			expect(await refundPayment(tx, admin, payment.id, 'Event moved', deps)).toBe('ok');
			expect((await paymentRow(tx, payment.id)).status).toBe('refunded');
			expect((await registrationOf(tx, registrationId)).status).toBe('cancelled');
			expect((await registrationOf(tx, waiting.id)).status).toBe('pending_payment');
			expect(sent.map((m) => m.to).sort()).toEqual([member.email, queued.email].sort());
		});
	});
});
