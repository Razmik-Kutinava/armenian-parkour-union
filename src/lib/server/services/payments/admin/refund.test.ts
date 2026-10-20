import { afterAll, describe, expect, it } from 'vitest';
import { testDb, testDbUrl } from '../../../db/test-db';
import { startMembershipPayment } from '../../memberships/start';
import {
	auditFor,
	effectsWith,
	mailbox,
	membershipRow,
	settle,
	startDeps,
	verifiedUser
} from '../../memberships/test-support';
import { applyProviderStatus } from '../apply';
import { createMockProvider, type MockProvider } from '../providers/mock';
import { manualProvider } from '../providers/manual';
import type { PaymentProvider } from '../providers/types';
import { paymentRow } from '../test-support';
import { refundMode, refundPayment } from './refund';
import { allEffects, insertPayment, staff } from './test-support';

/* docs/07 section 11: only paid → refunded, a reason, full amount; through the provider API when
 * it has one, otherwise the admin marks the bank refund done. Effects and the letter once. */

const registry =
	(provider: PaymentProvider) =>
	(id: string): PaymentProvider | null =>
		id === provider.id ? provider : id === 'manual' ? manualProvider : null;

describe('admin payments: refund mode', () => {
	const mock = createMockProvider();
	const providerOf = registry(mock);
	it('api only for a provider with refunds, its id, and no manual confirmation', () => {
		const base = { provider: 'mock', providerPaymentId: 'mock_1', confirmedBy: null };
		expect(refundMode(base, providerOf)).toBe('api');
		expect(refundMode({ ...base, confirmedBy: crypto.randomUUID() }, providerOf)).toBe('manual');
		expect(refundMode({ ...base, providerPaymentId: null }, providerOf)).toBe('manual');
		expect(refundMode({ ...base, provider: 'manual' }, providerOf)).toBe('manual');
		expect(refundMode({ ...base, provider: 'gone' }, providerOf)).toBe('manual');
	});
});

describe.skipIf(!testDbUrl)('admin payments: refund', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	async function paidFee(tx: Parameters<Parameters<typeof inRollback>[0]>[0], provider: MockProvider) {
		const user = await verifiedUser(tx);
		const started = await startMembershipPayment(tx, user.id, 'en', startDeps(provider));
		if (!started.ok) throw new Error(started.reason);
		await settle(tx, provider, started.paymentId, 'paid', effectsWith(mailbox().send));
		return { user, paymentId: started.paymentId };
	}

	it('api: the provider returns the money, membership cancelled, one letter, audit', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const provider = createMockProvider();
			const { user, paymentId } = await paidFee(tx, provider);
			const { sent, send } = mailbox();
			const effects = allEffects(send);
			const deps = { effects, providerOf: registry(provider), ip: '10.0.0.9' };
			expect(await refundPayment(tx, admin, paymentId, 'Asked by member', deps)).toBe('ok');
			const row = await paymentRow(tx, paymentId);
			expect(row.status).toBe('refunded');
			expect(row.refundedAt).not.toBeNull();
			expect((await provider.getStatus(row.providerPaymentId!)).status).toBe('refunded');
			expect((await membershipRow(tx, row.membershipId!)).status).toBe('cancelled');
			expect(sent.map((m) => m.to)).toEqual([user.email]);
			expect(sent[0].text).toContain(paymentId);
			const audit = (await auditFor(tx, 'payment', paymentId)).filter(
				(e) => e.action === 'payment.refund'
			);
			expect(audit).toHaveLength(1);
			expect(audit[0]).toMatchObject({
				actorId: admin.id,
				before: { status: 'paid' },
				after: { status: 'refunded', reason: 'Asked by member', mode: 'api' }
			});

			const state = await provider.getStatus(row.providerPaymentId!);
			const report = { provider: 'mock', providerPaymentId: row.providerPaymentId!, ...state };
			expect(await applyProviderStatus(tx, report, effects)).toBe('unchanged');
			expect(sent).toHaveLength(1);
			expect(await refundPayment(tx, admin, paymentId, 'again', deps)).toBe('wrong_status');
		});
	});

	it('api refused or unreachable: nothing changes, no letter, no audit entry', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const provider = createMockProvider();
			const { paymentId } = await paidFee(tx, provider);
			const { sent, send } = mailbox();
			for (const refund of [
				async () => ({ ok: false, raw: {} }),
				async () => {
					throw new Error('bank is down');
				}
			]) {
				const broken = { ...provider, refund };
				const deps = { effects: allEffects(send), providerOf: registry(broken), ip: null };
				expect(await refundPayment(tx, admin, paymentId, 'Try', deps)).toBe('provider_error');
			}
			expect((await paymentRow(tx, paymentId)).status).toBe('paid');
			expect(sent).toHaveLength(0);
			const audit = await auditFor(tx, 'payment', paymentId);
			expect(audit.some((e) => e.action === 'payment.refund')).toBe(false);
		});
	});

	it('manual: a cash donation is marked refunded, the guest donor gets the letter', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const payment = await insertPayment(tx, { status: 'paid', paidAt: new Date() });
			const { sent, send } = mailbox();
			const deps = { effects: allEffects(send), providerOf: registry(manualProvider), ip: null };
			expect(await refundPayment(tx, admin, payment.id, 'Returned in cash', deps)).toBe('ok');
			expect((await paymentRow(tx, payment.id)).status).toBe('refunded');
			expect(sent.map((m) => m.to)).toEqual(['anna.guest@example.com']);
			const [entry] = (await auditFor(tx, 'payment', payment.id)).filter(
				(e) => e.action === 'payment.refund'
			);
			expect(entry.after).toMatchObject({ mode: 'manual' });
		});
	});

	it('refusals: not paid, no reason, unknown id, not an admin', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const deps = {
				effects: allEffects(mailbox().send),
				providerOf: registry(manualProvider),
				ip: null
			};
			const pending = await insertPayment(tx);
			const paid = await insertPayment(tx, { status: 'paid', paidAt: new Date() });
			expect(await refundPayment(tx, admin, pending.id, 'x', deps)).toBe('wrong_status');
			expect(await refundPayment(tx, admin, paid.id, ' ', deps)).toBe('invalid');
			expect(await refundPayment(tx, admin, crypto.randomUUID(), 'x', deps)).toBe('not_found');
			const editor = await staff(tx, 'editor');
			expect(await refundPayment(tx, editor, paid.id, 'x', deps)).toBe('not_allowed');
			expect((await paymentRow(tx, paid.id)).status).toBe('paid');
		});
	});
});
