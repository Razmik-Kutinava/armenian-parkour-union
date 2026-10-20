import { afterAll, describe, expect, it } from 'vitest';
import { testDb, testDbUrl } from '../../db/test-db';
import { startDonationPayment } from '../donations/start';
import { donationDeps, guestInput } from '../donations/test-support';
import { membershipRow, membershipsOf, verifiedUser } from '../memberships/test-support';
import {
	deliver,
	feeStarted,
	onlyProvider,
	productionEffects,
	userRow
} from './acceptance-support';
import { recordManualPayment } from './admin/manual';
import { refundPayment } from './admin/refund';
import { manualDonation, staff } from './admin/test-support';
import { createMockProvider } from './providers/mock';
import { paymentRow } from './test-support';
import { testIp } from './webhook-support';

/* docs/07 section 15, money on mock with the production effects: a guest donates, an admin's
 * manual payment works like an online one, a refund undoes the membership. */

const lengthOf = (m: { startsAt: Date | null; endsAt: Date | null }) =>
	m.endsAt!.getTime() - m.startsAt!.getTime();

describe.skipIf(!testDbUrl)('payments acceptance: donations, manual payments, refunds', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a guest donation: started without an account, paid by the webhook, one thank-you letter', async () => {
		await inRollback(async (tx) => {
			const mock = createMockProvider();
			const { sent, effects } = productionEffects();
			const email = `guest-${crypto.randomUUID()}@example.com`;
			const input = guestInput({ donorEmail: email });
			const started = await startDonationPayment(tx, input, donationDeps(mock, { ip: testIp() }));
			if (!started.ok) throw new Error(started.reason);
			const payment = await paymentRow(tx, started.paymentId);
			expect(payment).toMatchObject({ userId: null, status: 'pending', donorEmail: email });
			const notice = mock.simulate(payment.providerPaymentId!, 'paid');
			expect(await deliver(tx, mock, notice, effects)).toBe(200);
			expect(await deliver(tx, mock, notice, effects)).toBe(200);
			expect(await paymentRow(tx, payment.id)).toMatchObject({ status: 'paid', userId: null });
			expect(sent.map((m) => m.to)).toEqual([email]);
			expect(sent[0].text).toContain(payment.id);
		});
	});

	it('a manual fee by an admin runs the same effects as an online fee', async () => {
		await inRollback(async (tx) => {
			const mock = createMockProvider();
			const { sent, effects } = productionEffects();
			const online = await feeStarted(tx, mock);
			const notice = mock.simulate(online.payment.providerPaymentId!, 'paid');
			expect(await deliver(tx, mock, notice, effects)).toBe(200);

			const admin = await staff(tx);
			const member = await verifiedUser(tx);
			const input = manualDonation({ kind: 'membership', payerEmail: member.email });
			const manual = await recordManualPayment(tx, admin, input, { effects, ip: null });
			if (!manual.ok) throw new Error(manual.reason);

			const [byOnline] = await membershipsOf(tx, online.user.id);
			const byManual = await membershipRow(
				tx,
				(await paymentRow(tx, manual.paymentId)).membershipId!
			);
			for (const m of [byOnline, byManual]) {
				expect(m.status).toBe('active');
				expect(Math.abs(m.startsAt!.getTime() - Date.now())).toBeLessThan(5 * 60_000);
			}
			expect(Math.abs(lengthOf(byOnline) - lengthOf(byManual))).toBeLessThan(60_000);
			for (const id of [online.user.id, member.id]) {
				expect((await userRow(tx, id)).level).toBe('novice');
			}
			expect(sent.map((m) => m.to)).toEqual([online.user.email, member.email]);
			expect(sent[1].subject).toBe(sent[0].subject);
		});
	});

	it('a refund of an online fee: membership cancelled, level kept, refund letter', async () => {
		await inRollback(async (tx) => {
			const mock = createMockProvider();
			const { sent, effects } = productionEffects();
			const { user, payment } = await feeStarted(tx, mock);
			const notice = mock.simulate(payment.providerPaymentId!, 'paid');
			expect(await deliver(tx, mock, notice, effects)).toBe(200);

			const admin = await staff(tx);
			const deps = { effects, providerOf: onlyProvider(mock), ip: null };
			expect(await refundPayment(tx, admin, payment.id, 'Asked by member', deps)).toBe('ok');
			expect((await paymentRow(tx, payment.id)).status).toBe('refunded');
			expect((await membershipsOf(tx, user.id)).map((m) => m.status)).toEqual(['cancelled']);
			expect((await userRow(tx, user.id)).level).toBe('novice');
			expect(sent.map((m) => m.to)).toEqual([user.email, user.email]);
			expect(sent[1].subject).not.toBe(sent[0].subject);
			expect(sent[1].text).toContain(payment.id);
		});
	});
});
