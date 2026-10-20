import { afterAll, describe, expect, it } from 'vitest';
import { memberships } from '../../../db/schema/payments';
import { insertUser, testDb, testDbUrl } from '../../../db/test-db';
import { auditFor, mailbox } from '../../memberships/test-support';
import { SITE, paymentRow } from '../test-support';
import { resendReceipt } from './receipt';
import { resolveReview } from './review';
import { insertPayment, staff } from './test-support';

/* docs/05 section 16: "needs review" is cleared by an admin with a comment; the receipt
 * (docs/07 section 12 p. 1) can be sent again. Both go to the audit log. */

describe.skipIf(!testDbUrl)('admin payments: needs review', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('an admin clears the flag with a comment; audit keeps it', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const payment = await insertPayment(tx, { status: 'failed', needsReview: true });
			expect(await resolveReview(tx, admin, payment.id, 'Checked with bank', '10.0.0.1')).toBe(
				'ok'
			);
			expect((await paymentRow(tx, payment.id)).needsReview).toBe(false);
			expect(await auditFor(tx, 'payment', payment.id)).toMatchObject([
				{
					actorId: admin.id,
					action: 'payment.review_resolved',
					before: { needsReview: true },
					after: { needsReview: false, comment: 'Checked with bank' }
				}
			]);
			expect(await resolveReview(tx, admin, payment.id, 'again', null)).toBe('wrong_status');
		});
	});

	it('refusals: no comment, unknown id, not an admin', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const payment = await insertPayment(tx, { needsReview: true });
			expect(await resolveReview(tx, admin, payment.id, '', null)).toBe('invalid');
			expect(await resolveReview(tx, admin, crypto.randomUUID(), 'x', null)).toBe('not_found');
			const moderator = await staff(tx, 'moderator');
			expect(await resolveReview(tx, moderator, payment.id, 'x', null)).toBe('not_allowed');
			expect((await paymentRow(tx, payment.id)).needsReview).toBe(true);
		});
	});
});

describe.skipIf(!testDbUrl)('admin payments: resend the receipt', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('donation: the thank-you letter with the receipt again; audit', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const payment = await insertPayment(tx, { status: 'paid', paidAt: new Date() });
			const { sent, send } = mailbox();
			const deps = { send, siteUrl: SITE, ip: null };
			expect(await resendReceipt(tx, admin, payment.id, deps)).toBe('ok');
			expect(sent.map((m) => m.to)).toEqual(['anna.guest@example.com']);
			expect(sent[0].text).toContain(payment.id);
			const audit = await auditFor(tx, 'payment', payment.id);
			expect(audit).toMatchObject([{ actorId: admin.id, action: 'payment.receipt_resend' }]);
		});
	});

	it('membership: the paid letter with the period of this payment', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const member = await insertUser(tx);
			const payment = await insertPayment(tx, {
				kind: 'membership',
				userId: member.id,
				donorName: null,
				donorEmail: null,
				status: 'paid',
				paidAt: new Date()
			});
			await tx.insert(memberships).values({
				userId: member.id,
				status: 'active',
				paymentId: payment.id,
				startsAt: new Date('2026-10-01T00:00:00Z'),
				endsAt: new Date('2027-10-01T00:00:00Z')
			});
			const { sent, send } = mailbox();
			const deps = { send, siteUrl: SITE, ip: null };
			expect(await resendReceipt(tx, admin, payment.id, deps)).toBe('ok');
			expect(sent.map((m) => m.to)).toEqual([member.email]);
			expect(sent[0].text).toContain('2027');
		});
	});

	it('refusals: not paid, event fee, guest without email, fee without a period, mail down', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const member = await insertUser(tx);
			const paidAt = new Date();
			const { send } = mailbox();
			const deps = { send, siteUrl: SITE, ip: null };
			const pending = await insertPayment(tx);
			const eventFee = await insertPayment(tx, { kind: 'event_fee', status: 'paid', paidAt });
			const noEmail = await insertPayment(tx, { status: 'paid', paidAt, donorEmail: null });
			const noPeriod = await insertPayment(tx, {
				kind: 'membership',
				userId: member.id,
				status: 'paid',
				paidAt
			});
			const paid = await insertPayment(tx, { status: 'paid', paidAt });
			expect(await resendReceipt(tx, admin, pending.id, deps)).toBe('wrong_status');
			expect(await resendReceipt(tx, admin, eventFee.id, deps)).toBe('unsupported');
			expect(await resendReceipt(tx, admin, noEmail.id, deps)).toBe('no_recipient');
			expect(await resendReceipt(tx, admin, noPeriod.id, deps)).toBe('unsupported');
			const down = { ...deps, send: mailbox(true).send };
			expect(await resendReceipt(tx, admin, paid.id, down)).toBe('mail_failed');
			expect(await auditFor(tx, 'payment', paid.id)).toHaveLength(0);
			const editor = await staff(tx, 'editor');
			expect(await resendReceipt(tx, editor, paid.id, deps)).toBe('not_allowed');
		});
	});
});
