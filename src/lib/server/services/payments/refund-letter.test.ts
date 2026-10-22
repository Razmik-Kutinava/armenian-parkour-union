import { afterAll, describe, expect, it } from 'vitest';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { mailbox } from '../memberships/test-support';
import { insertPayment } from './admin/test-support';
import type { PaymentEffect } from './effects';
import { refundLetter, withRefundLetter } from './refund-letter';

/* docs/07 section 11 p. 4-5: after a refund the payer gets a letter; when the money arrives
 * depends on the bank. Every kind, whoever started the refund (admin or provider). */

describe.skipIf(!testDbUrl)('payments: refund letter', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('guest: English letter to the donor email with amount and payment number', async () => {
		await inRollback(async (tx) => {
			const payment = await insertPayment(tx, { status: 'refunded', amountMinor: 15_000 });
			const letter = await refundLetter(tx, payment);
			expect(letter?.to).toBe('anna.guest@example.com');
			expect(letter?.subject).toBe('Your payment has been refunded');
			expect(letter?.text).toMatch(/15,000/);
			expect(letter?.text).toContain(payment.id);
			expect(letter?.text).toContain('bank');
		});
	});

	it('guest: the letter is in the language the payment was started in', async () => {
		await inRollback(async (tx) => {
			const payment = await insertPayment(tx, { status: 'refunded', locale: 'ru' });
			const letter = await refundLetter(tx, payment);
			expect(letter?.to).toBe('anna.guest@example.com');
			expect(letter?.subject).toBe('Платёж возвращён');
		});
	});

	it('member: account email in the account language; deleted member or no email — none', async () => {
		await inRollback(async (tx) => {
			const member = await insertUser(tx, { locale: 'ru' });
			const own = await insertPayment(tx, { kind: 'membership', userId: member.id, locale: 'en' });
			const letter = await refundLetter(tx, own);
			expect(letter?.to).toBe(member.email);
			expect(letter?.subject).toBe('Платёж возвращён');
			const gone = await insertUser(tx, { deletedAt: new Date() });
			const ofGone = await insertPayment(tx, { userId: gone.id });
			expect(await refundLetter(tx, ofGone)).toBeNull();
			expect(await refundLetter(tx, await insertPayment(tx, { donorEmail: null }))).toBeNull();
		});
	});

	it('wrapper: the kind effect runs first, the letter only after the commit, other statuses as is', async () => {
		await inRollback(async (tx) => {
			const calls: string[] = [];
			const paid: PaymentEffect = async () => void calls.push('paid');
			const refunded: PaymentEffect = async () => void calls.push('refunded');
			const { sent, send } = mailbox();
			const effects = withRefundLetter({ membership: { paid, refunded } }, send);
			expect(effects.membership?.paid).toBe(paid);
			const payment = await insertPayment(tx, { status: 'refunded' });
			const jobs: (() => Promise<void>)[] = [];
			await effects.membership!.refunded!(tx, payment, (job) => jobs.push(job));
			await effects.donation!.refunded!(tx, payment, (job) => jobs.push(job));
			await effects.event_fee!.refunded!(tx, payment, (job) => jobs.push(job));
			expect(calls).toEqual(['refunded']);
			expect(sent).toHaveLength(0);
			for (const job of jobs) await job();
			expect(sent).toHaveLength(3);
		});
	});
});
