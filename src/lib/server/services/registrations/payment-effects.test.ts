import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { eventRegistrations } from '../../db/schema/registrations';
import { users } from '../../db/schema/users';
import { testDb, testDbUrl } from '../../db/test-db';
import { auditFor } from '../memberships/test-support';
import { insertPayment } from '../payments/admin/test-support';
import { applyProviderStatus } from '../payments/apply';
import { createMockProvider } from '../payments/providers/mock';
import { paymentRow } from '../payments/test-support';
import { startEventPayment } from './pay';
import { feeEffects, paidEvent, payDeps, payStarted, settleFee } from './pay-support';
import { SEAT_STATUSES } from './seats';
import {
	insertCategory,
	insertMember,
	mailbox,
	registerOk,
	registrationOf,
	registrationsOf
} from './test-support';

/* docs/07 sections 5.3 p. 3-5, 8, 11 p. 3: paid — the registration counts; paid late — only into a
 * free seat, otherwise an admin decides; refunded — the seat goes to the waitlist. */

const reviews = async (tx: Parameters<typeof auditFor>[0], paymentId: string) =>
	(await auditFor(tx, 'payment', paymentId))
		.filter((e) => e.action === 'event_fee.review')
		.map((e) => (e.after as { reason: string }).reason);

const seatsTaken = async (tx: Parameters<typeof auditFor>[0], eventId: string) =>
	(await registrationsOf(tx, eventId)).filter((r) => SEAT_STATUSES.includes(r.status)).length;

describe.skipIf(!testDbUrl)('registrations: event fee effects', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('paid: the registration counts, the hold is gone; a duplicate changes nothing', async () => {
		await inRollback(async (tx) => {
			const mock = createMockProvider();
			const effects = feeEffects();
			const event = await paidEvent(tx);
			const { registrationId, payment } = await payStarted(tx, mock, event.id);
			expect(await settleFee(tx, mock, payment.id, 'paid', effects)).toBe('applied');
			expect(await registrationOf(tx, registrationId)).toMatchObject({
				status: 'registered',
				holdUntil: null,
				paymentId: payment.id
			});
			expect(await settleFee(tx, mock, payment.id, 'paid', effects)).toBe('unchanged');
			expect((await paymentRow(tx, payment.id)).needsReview).toBe(false);
			expect(await reviews(tx, payment.id)).toEqual([]);
		});
	});

	it('failed or cancelled at the provider: the seat stays held until the hold ends', async () => {
		await inRollback(async (tx) => {
			const mock = createMockProvider();
			const effects = feeEffects();
			const event = await paidEvent(tx);
			for (const status of ['failed', 'cancelled'] as const) {
				const { registrationId, payment } = await payStarted(tx, mock, event.id);
				expect(await settleFee(tx, mock, payment.id, status, effects)).toBe('applied');
				expect((await registrationOf(tx, registrationId)).status).toBe('pending_payment');
			}
		});
	});

	it('paid late with a free seat: the cancelled registration counts again', async () => {
		await inRollback(async (tx) => {
			const mock = createMockProvider();
			const effects = feeEffects();
			const event = await paidEvent(tx, { capacity: 2 });
			const { registrationId, payment } = await payStarted(tx, mock, event.id);
			await settleFee(tx, mock, payment.id, 'cancelled', effects);
			await tx
				.update(eventRegistrations)
				.set({ status: 'cancelled', holdUntil: null })
				.where(eq(eventRegistrations.id, registrationId));
			expect(await settleFee(tx, mock, payment.id, 'paid', effects)).toBe('applied');
			expect((await registrationOf(tx, registrationId)).status).toBe('registered');
			expect((await paymentRow(tx, payment.id)).needsReview).toBe(false);
		});
	});

	it('paid late without a seat: paid, the limit holds, the payment goes to review', async () => {
		await inRollback(async (tx) => {
			const mock = createMockProvider();
			const effects = feeEffects();
			const event = await paidEvent(tx, { capacity: 1 });
			const { registrationId, payment } = await payStarted(tx, mock, event.id);
			await settleFee(tx, mock, payment.id, 'cancelled', effects);
			await tx
				.update(eventRegistrations)
				.set({ status: 'cancelled', holdUntil: null })
				.where(eq(eventRegistrations.id, registrationId));
			const other = await insertMember(tx);
			await registerOk(tx, other.id, event.id);

			expect(await settleFee(tx, mock, payment.id, 'paid', effects)).toBe('applied');
			expect(await paymentRow(tx, payment.id)).toMatchObject({ status: 'paid', needsReview: true });
			expect((await registrationOf(tx, registrationId)).status).toBe('cancelled');
			expect(await seatsTaken(tx, event.id)).toBe(1);
			expect(await reviews(tx, payment.id)).toEqual(['late_payment_no_seat']);
		});
	});

	it('paid late into a full category: review, even with seats left in the event', async () => {
		await inRollback(async (tx) => {
			const mock = createMockProvider();
			const effects = feeEffects();
			const event = await paidEvent(tx);
			const category = await insertCategory(tx, event.id, { capacity: 1 });
			const member = await insertMember(tx);
			await registerOk(tx, member.id, event.id, category.id);
			const started = await startEventPayment(tx, member.id, event.id, 'en', payDeps(mock));
			if (!started.ok) throw new Error(started.reason);
			const [row] = await registrationsOf(tx, event.id);
			await tx
				.update(eventRegistrations)
				.set({ status: 'cancelled', holdUntil: null })
				.where(eq(eventRegistrations.id, row.id));
			await registerOk(tx, (await insertMember(tx)).id, event.id, category.id);
			expect(await settleFee(tx, mock, started.paymentId, 'paid', effects)).toBe('applied');
			expect((await registrationOf(tx, row.id)).status).toBe('cancelled');
			expect(await reviews(tx, started.paymentId)).toEqual(['late_payment_no_seat']);
		});
	});

	it('paid while the member is blocked: nothing activated, review', async () => {
		await inRollback(async (tx) => {
			const mock = createMockProvider();
			const effects = feeEffects();
			const event = await paidEvent(tx);
			const { member, registrationId, payment } = await payStarted(tx, mock, event.id);
			await tx.update(users).set({ status: 'blocked' }).where(eq(users.id, member.id));
			expect(await settleFee(tx, mock, payment.id, 'paid', effects)).toBe('applied');
			expect((await registrationOf(tx, registrationId)).status).toBe('pending_payment');
			expect(await paymentRow(tx, payment.id)).toMatchObject({ status: 'paid', needsReview: true });
			expect(await reviews(tx, payment.id)).toEqual(['user_blocked']);
		});
	});

	it('paid with no registration on it, or one already counted: review, nothing changes', async () => {
		await inRollback(async (tx) => {
			const effects = feeEffects();
			const member = await insertMember(tx);
			const lonely = await insertPayment(tx, {
				kind: 'event_fee',
				status: 'pending',
				userId: member.id,
				provider: 'test-fee',
				providerPaymentId: `p_${crypto.randomUUID()}`
			});
			const report = (p: typeof lonely) => ({
				provider: p.provider,
				providerPaymentId: p.providerPaymentId!,
				status: 'paid' as const,
				amountMinor: p.amountMinor,
				currency: p.currency,
				raw: {}
			});
			expect(await applyProviderStatus(tx, report(lonely), effects)).toBe('applied');
			expect(await reviews(tx, lonely.id)).toEqual(['registration_missing']);

			const event = await paidEvent(tx);
			const { id } = await registerOk(tx, member.id, event.id);
			const twice = await insertPayment(tx, {
				kind: 'event_fee',
				status: 'pending',
				userId: member.id,
				provider: 'test-fee',
				providerPaymentId: `p_${crypto.randomUUID()}`
			});
			await tx
				.update(eventRegistrations)
				.set({ status: 'registered', holdUntil: null, paymentId: twice.id })
				.where(eq(eventRegistrations.id, id));
			expect(await applyProviderStatus(tx, report(twice), effects)).toBe('applied');
			expect(await reviews(tx, twice.id)).toEqual(['registration_already_active']);
			expect((await registrationOf(tx, id)).status).toBe('registered');
		});
	});

	it('refunded: the registration is cancelled and the first in line gets the seat', async () => {
		await inRollback(async (tx) => {
			const mock = createMockProvider();
			const box = mailbox();
			const effects = feeEffects(box.send);
			const event = await paidEvent(tx, { capacity: 1 });
			const { registrationId, payment } = await payStarted(tx, mock, event.id);
			await settleFee(tx, mock, payment.id, 'paid', effects);
			const queued = await insertMember(tx);
			const waiting = await registerOk(tx, queued.id, event.id);
			expect(waiting.status).toBe('waitlist');

			expect(await settleFee(tx, mock, payment.id, 'refunded', effects)).toBe('applied');
			expect((await registrationOf(tx, registrationId)).status).toBe('cancelled');
			const promoted = await registrationOf(tx, waiting.id);
			expect(promoted.status).toBe('pending_payment');
			expect(promoted.holdUntil).not.toBeNull();
			expect(box.sent.map((m) => m.to)).toEqual([queued.email]);
		});
	});
});
