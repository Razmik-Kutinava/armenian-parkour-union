import { afterAll, describe, expect, it } from 'vitest';
import { testDb, testDbUrl } from '../../../db/test-db';
import { startMembershipPayment } from '../../memberships/start';
import {
	auditFor,
	mailbox,
	membershipRow,
	startDeps,
	verifiedUser
} from '../../memberships/test-support';
import { applyProviderStatus } from '../apply';
import { createMockProvider } from '../providers/mock';
import { paidEvent, payStarted } from '../../registrations/pay-support';
import { registrationOf } from '../../registrations/test-support';
import { paymentRow } from '../test-support';
import { confirmPaymentManually } from './confirm';
import { allEffects, insertPayment, staff } from './test-support';

/* docs/07 sections 8, 10: money arrived, the site still waits — an admin confirms by the bank
 * statement. Same amount, the same effects once, a comment in the audit log. */

describe.skipIf(!testDbUrl)('admin payments: confirm by statement', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('pending fee: paid, membership active, one letter; a later webhook changes nothing', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const user = await verifiedUser(tx);
			const provider = createMockProvider();
			const started = await startMembershipPayment(tx, user.id, 'en', startDeps(provider));
			if (!started.ok) throw new Error(started.reason);
			const { sent, send } = mailbox();
			const effects = allEffects(send);
			const deps = { effects, ip: '10.0.0.8' };
			const result = await confirmPaymentManually(
				tx,
				admin,
				started.paymentId,
				'Statement 77',
				deps
			);
			expect(result).toBe('ok');
			const row = await paymentRow(tx, started.paymentId);
			expect(row).toMatchObject({ status: 'paid', confirmedBy: admin.id, amountMinor: 20_000 });
			expect(row.paidAt).not.toBeNull();
			expect((await membershipRow(tx, row.membershipId!)).status).toBe('active');
			expect(sent).toHaveLength(1);
			const audit = (await auditFor(tx, 'payment', row.id)).filter(
				(e) => e.action === 'payment.confirm_manual'
			);
			expect(audit).toHaveLength(1);
			expect(audit[0]).toMatchObject({
				actorId: admin.id,
				before: { status: 'pending' },
				after: { status: 'paid', comment: 'Statement 77' }
			});

			provider.simulate(row.providerPaymentId!, 'paid');
			const state = await provider.getStatus(row.providerPaymentId!);
			const report = { provider: 'mock', providerPaymentId: row.providerPaymentId!, ...state };
			expect(await applyProviderStatus(tx, report, effects)).toBe('unchanged');
			expect(sent).toHaveLength(1);
			expect(await confirmPaymentManually(tx, admin, row.id, 'again', deps)).toBe('wrong_status');
		});
	});

	it('failed or cancelled donation: paid, review flag cleared, thank-you letter', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			for (const status of ['failed', 'cancelled'] as const) {
				const payment = await insertPayment(tx, { status, needsReview: true });
				const { sent, send } = mailbox();
				const deps = { effects: allEffects(send), ip: null };
				expect(await confirmPaymentManually(tx, admin, payment.id, 'Cash', deps)).toBe('ok');
				expect(await paymentRow(tx, payment.id)).toMatchObject({
					status: 'paid',
					needsReview: false,
					confirmedBy: admin.id
				});
				expect(sent.map((m) => m.to)).toEqual(['anna.guest@example.com']);
			}
		});
	});

	it('pending event fee: paid, the registration counts — the same effects as online (docs/07 section 9)', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const event = await paidEvent(tx);
			const { registrationId, payment } = await payStarted(tx, createMockProvider(), event.id);
			const deps = { effects: allEffects(mailbox().send), ip: null };
			expect(await confirmPaymentManually(tx, admin, payment.id, 'Cash at the gym', deps)).toBe(
				'ok'
			);
			expect((await paymentRow(tx, payment.id)).status).toBe('paid');
			expect(await registrationOf(tx, registrationId)).toMatchObject({
				status: 'registered',
				holdUntil: null
			});
		});
	});

	it('refusals: paid or refunded, no comment, unknown id, not an admin', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const deps = { effects: allEffects(mailbox().send), ip: null };
			const paid = await insertPayment(tx, { status: 'paid', paidAt: new Date() });
			const refunded = await insertPayment(tx, { status: 'refunded', paidAt: new Date() });
			const pending = await insertPayment(tx, { status: 'pending' });
			expect(await confirmPaymentManually(tx, admin, paid.id, 'x', deps)).toBe('wrong_status');
			expect(await confirmPaymentManually(tx, admin, refunded.id, 'x', deps)).toBe('wrong_status');
			expect(await confirmPaymentManually(tx, admin, pending.id, '  ', deps)).toBe('invalid');
			expect(await confirmPaymentManually(tx, admin, 'nope', 'x', deps)).toBe('not_found');
			expect(await confirmPaymentManually(tx, admin, crypto.randomUUID(), 'x', deps)).toBe(
				'not_found'
			);
			const moderator = await staff(tx, 'moderator');
			expect(await confirmPaymentManually(tx, moderator, pending.id, 'x', deps)).toBe(
				'not_allowed'
			);
			expect((await paymentRow(tx, pending.id)).status).toBe('pending');
		});
	});
});
