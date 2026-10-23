import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { eventRegistrations } from '../../db/schema/registrations';
import { testDbUrl } from '../../db/test-db';
import { auditFor } from '../memberships/test-support';
import { createMockProvider } from '../payments/providers/mock';
import { paymentRow } from '../payments/test-support';
import { startEventPayment } from './pay';
import { PRICE, feeEffects, payDeps, settleFee } from './pay-support';
import { raceDb } from './race-support';
import { registerForEvent } from './register';
import { SEAT_STATUSES } from './seats';
import { SETTINGS, registrationOf, registrationsOf } from './test-support';

/* docs/07 section 5.3 p. 5, roadmap 5.10: a payment that comes after its seat was released counts
 * only into a free seat. Racing a new registration for the last seat, whoever gets the event row
 * lock first has it; the other waits in line or goes to the admin. These tests commit. */

describe.skipIf(!testDbUrl)('registrations: a late payment races a new registration', () => {
	const db = raceDb();
	afterAll(db.cleanup);
	const mock = createMockProvider();

	/** A paid event with one seat; its member started paying, the hold ran out and was released. */
	async function released() {
		const event = await db.event({ capacity: 1, priceAmountMinor: PRICE });
		const late = await db.member();
		const input = { eventId: event.id, categoryId: null };
		const held = await registerForEvent(db.main, late.id, input, { settings: SETTINGS });
		if (!held.ok) throw new Error(held.reason);
		const started = await startEventPayment(db.main, late.id, event.id, 'en', payDeps(mock));
		if (!started.ok) throw new Error(started.reason);
		await settleFee(db.main, mock, started.paymentId, 'cancelled', feeEffects());
		await db.main
			.update(eventRegistrations)
			.set({ status: 'cancelled', holdUntil: null })
			.where(eq(eventRegistrations.id, held.id));
		const newcomer = await db.member();
		const pay = (tx: LimitDb) => settleFee(tx, mock, started.paymentId, 'paid', feeEffects());
		const join = (tx: LimitDb) => registerForEvent(tx, newcomer.id, input, { settings: SETTINGS });
		return { event, registrationId: held.id, paymentId: started.paymentId, pay, join };
	}

	const reviews = async (paymentId: string) =>
		(await auditFor(db.main, 'payment', paymentId))
			.filter((e) => e.action === 'event_fee.review')
			.map((e) => (e.after as { reason: string }).reason);
	const seatsTaken = async (eventId: string) =>
		(await registrationsOf(db.main, eventId)).filter((r) => SEAT_STATUSES.includes(r.status))
			.length;

	it('the payment first: the late payer gets the seat, the newcomer waits in line', async () => {
		const { event, registrationId, paymentId, pay, join } = await released();
		const [applied, joined] = await db.race(pay, join);
		expect(applied).toBe('applied');
		expect(joined).toMatchObject({ ok: true, status: 'waitlist' });
		expect((await registrationOf(db.main, registrationId)).status).toBe('registered');
		expect(await paymentRow(db.main, paymentId)).toMatchObject({
			status: 'paid',
			needsReview: false
		});
		expect(await seatsTaken(event.id)).toBe(1);
	});

	it('the newcomer first: the seat is theirs, the late payment goes to review', async () => {
		const { event, registrationId, paymentId, pay, join } = await released();
		const [joined, applied] = await db.race(join, pay);
		expect(joined).toMatchObject({ ok: true, status: 'pending_payment' });
		expect(applied).toBe('applied');
		expect((await registrationOf(db.main, registrationId)).status).toBe('cancelled');
		expect(await paymentRow(db.main, paymentId)).toMatchObject({
			status: 'paid',
			needsReview: true
		});
		expect(await reviews(paymentId)).toEqual(['late_payment_no_seat']);
		expect(await seatsTaken(event.id)).toBe(1);
	});
});
