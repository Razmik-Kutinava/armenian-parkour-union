import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { payments } from '../../../db/schema/payments';
import { users } from '../../../db/schema/users';
import { insertUser, testDb, testDbUrl } from '../../../db/test-db';
import { addPurpose } from '../../donations/test-support';
import { auditFor, mailbox, membershipRow } from '../../memberships/test-support';
import { paymentRow } from '../test-support';
import { recordManualPayment } from './manual';
import { allEffects, manualDonation, staff } from './test-support';

/* docs/07 section 9, docs/05 section 16: a transfer outside the site is recorded by an admin as
 * paid (`provider = manual`, `confirmed_by`), the same effects run, the audit log keeps it. */

const TODAY = new Date('2026-10-20T08:00:00Z');

describe.skipIf(!testDbUrl)('admin payments: manual payment', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	const deps = (send = mailbox().send) => ({ effects: allEffects(send), ip: '10.0.0.7', today: TODAY });

	it('guest donation: paid, manual, confirmed by the admin, comment kept, letter, audit', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const { sent, send } = mailbox();
			const result = await recordManualPayment(tx, admin, manualDonation(), deps(send));
			if (!result.ok) throw new Error(result.reason);
			const row = await paymentRow(tx, result.paymentId);
			expect(row).toMatchObject({
				kind: 'donation',
				status: 'paid',
				provider: 'manual',
				amountMinor: 25_000,
				currency: 'AMD',
				userId: null,
				donorName: 'Cash Donor',
				donorEmail: 'cash.donor@example.com',
				confirmedBy: admin.id,
				needsReview: false,
				providerPayload: { manual: { comment: 'Bank transfer #1042' } }
			});
			expect(row.paidAt?.toISOString()).toBe('2026-09-30T20:00:00.000Z');
			expect(sent.map((m) => m.to)).toEqual(['cash.donor@example.com']);
			const audit = await auditFor(tx, 'payment', result.paymentId);
			expect(audit).toHaveLength(1);
			expect(audit[0]).toMatchObject({ actorId: admin.id, action: 'payment.confirm_manual' });
			expect(audit[0].after).toMatchObject({ status: 'paid', comment: 'Bank transfer #1042' });
			expect(audit[0].ip).toBe('10.0.0.7');
		});
	});

	it('member donation: payer by account email, any letter case; donor fields stay empty', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const member = await insertUser(tx);
			const { sent, send } = mailbox();
			const input = manualDonation({ payerEmail: member.email.toUpperCase() });
			const result = await recordManualPayment(tx, admin, input, deps(send));
			if (!result.ok) throw new Error(result.reason);
			expect(await paymentRow(tx, result.paymentId)).toMatchObject({
				userId: member.id,
				donorName: null,
				donorEmail: null
			});
			expect(sent.map((m) => m.to)).toEqual([member.email]);
		});
	});

	it('membership fee: a new membership becomes active through the usual effect', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const member = await insertUser(tx);
			const { sent, send } = mailbox();
			const input = manualDonation({ kind: 'membership', payerEmail: member.email });
			const result = await recordManualPayment(tx, admin, input, deps(send));
			if (!result.ok) throw new Error(result.reason);
			const row = await paymentRow(tx, result.paymentId);
			expect(row.membershipId).not.toBeNull();
			expect(row.donorName).toBeNull();
			const membership = await membershipRow(tx, row.membershipId!);
			expect(membership).toMatchObject({ status: 'active', paymentId: row.id, userId: member.id });
			const [user] = await tx.select().from(users).where(eq(users.id, member.id));
			expect(user.level).toBe('novice');
			expect(sent).toHaveLength(1);
			expect(sent[0].text).toContain(row.id);
		});
	});

	it('refusals: no payer for a fee, unknown or deleted payer, hidden purpose, future date', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const gone = await insertUser(tx, { deletedAt: new Date() });
			const hidden = await addPurpose(tx, { isActive: false });
			const cases = [
				[{ kind: 'membership' as const, payerEmail: null }, 'payer_required'],
				[{ payerEmail: 'nobody-here@example.com' }, 'payer_not_found'],
				[{ kind: 'membership' as const, payerEmail: gone.email }, 'payer_not_found'],
				[{ purposeId: hidden.id }, 'purpose_invalid'],
				[{ paidOn: '2026-10-21' }, 'future_date']
			] as const;
			for (const [extra, reason] of cases) {
				const result = await recordManualPayment(tx, admin, manualDonation(extra), deps());
				expect(result, reason).toEqual({ ok: false, reason });
			}
			const created = await tx.select().from(payments).where(eq(payments.confirmedBy, admin.id));
			expect(created).toHaveLength(0);
		});
	});

	it('only an admin: a moderator or editor records nothing (docs/04 section 3)', async () => {
		await inRollback(async (tx) => {
			for (const role of ['moderator', 'editor', 'member'] as const) {
				const actor = await staff(tx, role);
				const result = await recordManualPayment(tx, actor, manualDonation(), deps());
				expect(result).toEqual({ ok: false, reason: 'not_allowed' });
				const made = await tx.select().from(payments).where(eq(payments.confirmedBy, actor.id));
				expect(made).toHaveLength(0);
			}
		});
	});
});
