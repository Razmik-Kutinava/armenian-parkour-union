import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { eventRegistrations } from '../../db/schema/registrations';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { cancelEvent } from '../events/lifecycle';
import { auditFor } from '../memberships/test-support';
import { createMockProvider } from '../payments/providers/mock';
import { paymentRow } from '../payments/test-support';
import { feeEffects, paidEvent, payStarted, settleFee } from './pay-support';
import { insertMember, registerOk as register, registrationOf } from './test-support';

/* docs/03 section 7 p. 8, docs/05 section 5: the admin cancels the event — every active
 * registration is cancelled with it; the refund of a paid one is the admin's decision. */

const IP = '198.51.100.7';

describe.skipIf(!testDbUrl)('registrations: the event is cancelled', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('registered, unpaid and waiting registrations are cancelled; attended ones stay', async () => {
		await inRollback(async (tx) => {
			const admin = { id: (await insertUser(tx, { role: 'admin' })).id, role: 'admin' as const };
			const mock = createMockProvider();
			const event = await paidEvent(tx, { capacity: 3 });
			const paid = await payStarted(tx, mock, event.id);
			await settleFee(tx, mock, paid.payment.id, 'paid', feeEffects());
			const unpaid = await payStarted(tx, mock, event.id);
			const came = await register(tx, (await insertMember(tx)).id, event.id);
			await tx
				.update(eventRegistrations)
				.set({ status: 'attended' })
				.where(eq(eventRegistrations.id, came.id));
			const queued = await register(tx, (await insertMember(tx)).id, event.id);
			expect(queued.status).toBe('waitlist');

			expect(await cancelEvent(tx, admin, event.id, 'Bad weather', IP)).toBe('ok');
			for (const id of [paid.registrationId, unpaid.registrationId, queued.id]) {
				expect(await registrationOf(tx, id)).toMatchObject({ status: 'cancelled', holdUntil: null });
			}
			expect((await registrationOf(tx, came.id)).status).toBe('attended');
			const [entry] = (await auditFor(tx, 'event', event.id)).filter(
				(e) => e.action === 'event.cancel'
			);
			expect(entry.after).toMatchObject({ reason: 'Bad weather', registrationsCancelled: 3 });
		});
	});

	it('a waiting payment is cancelled, a paid one goes to review (the refund is the admin’s)', async () => {
		await inRollback(async (tx) => {
			const admin = { id: (await insertUser(tx, { role: 'admin' })).id, role: 'admin' as const };
			const mock = createMockProvider();
			const event = await paidEvent(tx);
			const paid = await payStarted(tx, mock, event.id);
			await settleFee(tx, mock, paid.payment.id, 'paid', feeEffects());
			const unpaid = await payStarted(tx, mock, event.id);

			expect(await cancelEvent(tx, admin, event.id, 'Bad weather', IP)).toBe('ok');
			expect(await paymentRow(tx, unpaid.payment.id)).toMatchObject({
				status: 'cancelled',
				failureReason: 'event_cancelled'
			});
			expect(await paymentRow(tx, paid.payment.id)).toMatchObject({
				status: 'paid',
				needsReview: true
			});
			const reviews = (await auditFor(tx, 'payment', paid.payment.id)).filter(
				(e) => e.action === 'event_fee.review'
			);
			expect(reviews.map((e) => e.after)).toMatchObject([
				{ reason: 'event_cancelled', registrationId: paid.registrationId, eventId: event.id }
			]);
		});
	});

	it('the refund made later by the admin changes nothing more', async () => {
		await inRollback(async (tx) => {
			const admin = { id: (await insertUser(tx, { role: 'admin' })).id, role: 'admin' as const };
			const mock = createMockProvider();
			const event = await paidEvent(tx);
			const paid = await payStarted(tx, mock, event.id);
			await settleFee(tx, mock, paid.payment.id, 'paid', feeEffects());
			expect(await cancelEvent(tx, admin, event.id, 'Bad weather', IP)).toBe('ok');
			await settleFee(tx, mock, paid.payment.id, 'refunded', feeEffects());
			expect(await paymentRow(tx, paid.payment.id)).toMatchObject({ status: 'refunded' });
			expect((await registrationOf(tx, paid.registrationId)).status).toBe('cancelled');
		});
	});
});
