import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { memberships } from '../../db/schema/payments';
import { users } from '../../db/schema/users';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { mailbox } from '../memberships/test-support';
import { createMockProvider } from '../payments/providers/mock';
import { paymentRow } from '../payments/test-support';
import { startDonationPayment } from './start';
import {
	addPurpose,
	donationDeps,
	donationEffectsWith,
	guestInput,
	settleDonation
} from './test-support';

/* docs/07 sections 5.2 p. 3, 11 p. 3, 12 p. 1: after `paid` only the status and a thank-you letter
 * with the receipt (amount, date, purpose, payment number); no points, no level, no membership. */

describe.skipIf(!testDbUrl)('donations: payment effects', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	async function begin(tx: Parameters<Parameters<typeof inRollback>[0]>[0], input = guestInput()) {
		const provider = createMockProvider();
		const result = await startDonationPayment(tx, input, donationDeps(provider));
		if (!result.ok) throw new Error(result.reason);
		return { provider, paymentId: result.paymentId };
	}

	it('guest, paid: one thank-you letter to the donor with amount, purpose and payment number', async () => {
		await inRollback(async (tx) => {
			const purpose = await addPurpose(tx);
			const { provider, paymentId } = await begin(
				tx,
				guestInput({ amount: '15000', purposeId: purpose.id })
			);
			const { sent, send } = mailbox();
			const effects = donationEffectsWith(send);
			expect(await settleDonation(tx, provider, paymentId, 'paid', effects)).toBe('applied');
			expect((await paymentRow(tx, paymentId)).status).toBe('paid');
			expect(sent).toHaveLength(1);
			expect(sent[0].to).toBe('anna.guest@example.com');
			expect(sent[0].subject).toBe('Thank you for your donation');
			expect(sent[0].text).toContain('Anna Guest');
			expect(sent[0].text).toMatch(/15,000/);
			expect(sent[0].text).toContain('Parkour park');
			expect(sent[0].text).toContain(paymentId);
		});
	});

	it('member, paid: the letter goes to the account email in the account language', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, { locale: 'ru', firstName: 'Арам' });
			const purpose = await addPurpose(tx);
			const { provider, paymentId } = await begin(
				tx,
				guestInput({ userId: user.id, purposeId: purpose.id, donorEmail: 'victim@example.com' })
			);
			const { sent, send } = mailbox();
			await settleDonation(tx, provider, paymentId, 'paid', donationEffectsWith(send));
			expect(sent).toHaveLength(1);
			expect(sent[0].to).toBe(user.email);
			expect(sent[0].subject).toBe('Спасибо за пожертвование');
			expect(sent[0].text).toContain('Арам');
			expect(sent[0].text).toContain('Паркур-парк');
		});
	});

	it('no purpose: the letter says general needs of the federation', async () => {
		await inRollback(async (tx) => {
			const { provider, paymentId } = await begin(tx);
			const { sent, send } = mailbox();
			await settleDonation(tx, provider, paymentId, 'paid', donationEffectsWith(send));
			expect(sent[0].text).toContain('general needs of the federation');
		});
	});

	it('a duplicate confirmation, a later refund, failed and cancelled: no more letters', async () => {
		await inRollback(async (tx) => {
			const { sent, send } = mailbox();
			const effects = donationEffectsWith(send);
			const paid = await begin(tx);
			await settleDonation(tx, paid.provider, paid.paymentId, 'paid', effects);
			expect(await settleDonation(tx, paid.provider, paid.paymentId, 'paid', effects)).toBe(
				'unchanged'
			);
			await settleDonation(tx, paid.provider, paid.paymentId, 'refunded', effects);
			const failed = await begin(tx);
			await settleDonation(tx, failed.provider, failed.paymentId, 'failed', effects);
			const cancelled = await begin(tx);
			await settleDonation(tx, cancelled.provider, cancelled.paymentId, 'cancelled', effects);
			expect(sent).toHaveLength(1);
		});
	});

	it('member donation gives no membership, no level and no points', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx);
			const { provider, paymentId } = await begin(tx, guestInput({ userId: user.id }));
			await settleDonation(tx, provider, paymentId, 'paid', donationEffectsWith(mailbox().send));
			const [row] = await tx.select().from(users).where(eq(users.id, user.id));
			expect(row).toMatchObject({ level: null, pointsBalance: 0 });
			expect(await tx.select().from(memberships).where(eq(memberships.userId, user.id))).toEqual(
				[]
			);
		});
	});

	it('deleted member: paid without a letter', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx);
			const { provider, paymentId } = await begin(tx, guestInput({ userId: user.id }));
			await tx.update(users).set({ deletedAt: new Date() }).where(eq(users.id, user.id));
			const { sent, send } = mailbox();
			expect(await settleDonation(tx, provider, paymentId, 'paid', donationEffectsWith(send))).toBe(
				'applied'
			);
			expect(sent).toEqual([]);
		});
	});
});
