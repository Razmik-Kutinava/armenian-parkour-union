import { afterAll, describe, expect, it } from 'vitest';
import { readListState } from '#lib/components/admin/list-state.ts';
import { memberships } from '../../../db/schema/payments';
import { insertUser, testDb, testDbUrl } from '../../../db/test-db';
import { writeAudit } from '../../audit';
import { addPurpose } from '../../donations/test-support';
import { manualProvider } from '../providers/manual';
import { getPaymentCard } from './card';
import { listPayments, paymentListOptions, paymentProviderOptions } from './list';
import { insertPayment, staff } from './test-support';

/* docs/05 section 16: list with filters in the URL, search by payer or number; the card shows
 * everything about one payment, its links and its audit history. */

const state = (query: Record<string, string>) =>
	readListState(new URLSearchParams(query), paymentListOptions);

describe.skipIf(!testDbUrl)('admin payments: list and card', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('search by guest name, member name, payment number and provider id', async () => {
		await inRollback(async (tx) => {
			const tag = crypto.randomUUID();
			const guest = await insertPayment(tx, { donorName: `Guest ${tag}` });
			const member = await insertUser(tx);
			const own = await insertPayment(tx, {
				userId: member.id,
				donorName: null,
				donorEmail: null,
				provider: 'mock',
				providerPaymentId: `mock_${tag}`
			});
			const byGuest = await listPayments(tx, state({ q: tag.slice(0, 13) }));
			expect(byGuest.rows.map((r) => r.id)).toContain(guest.id);
			expect(byGuest.rows.find((r) => r.id === guest.id)?.payerName).toBe(`Guest ${tag}`);
			const byMember = await listPayments(tx, state({ q: member.tag }));
			expect(byMember.rows).toMatchObject([{ id: own.id, payerEmail: member.email }]);
			expect(byMember.total).toBe(1);
			expect((await listPayments(tx, state({ q: guest.id }))).rows.map((r) => r.id)).toEqual([
				guest.id
			]);
			const byProviderId = await listPayments(tx, state({ q: `mock_${tag}` }));
			expect(byProviderId.rows.map((r) => r.id)).toEqual([own.id]);
		});
	});

	it('filters: kind, status, provider, needs review, period; unknown values are ignored', async () => {
		await inRollback(async (tx) => {
			const tag = crypto.randomUUID();
			const name = `Filter ${tag}`;
			const a = await insertPayment(tx, { donorName: name, status: 'paid', paidAt: new Date() });
			const b = await insertPayment(tx, { donorName: name, needsReview: true, status: 'failed' });
			const c = await insertPayment(tx, {
				donorName: name,
				kind: 'membership',
				provider: 'mock',
				createdAt: new Date('2026-01-10T12:00:00Z')
			});
			const ids = async (query: Record<string, string>) =>
				(await listPayments(tx, state({ q: name, ...query }))).rows.map((r) => r.id).sort();
			expect(await ids({})).toEqual([a.id, b.id, c.id].sort());
			expect(await ids({ kind: 'membership' })).toEqual([c.id]);
			expect(await ids({ status: 'paid' })).toEqual([a.id]);
			expect(await ids({ provider: 'mock' })).toEqual([c.id]);
			expect(await ids({ review: '1' })).toEqual([b.id]);
			expect(await ids({ from: '2026-01-10', to: '2026-01-10' })).toEqual([c.id]);
			expect(await ids({ to: '2026-01-09' })).toEqual([]);
			expect(await ids({ status: 'bogus', kind: 'x', from: '2026-13-40' })).toHaveLength(3);
			expect(await paymentProviderOptions(tx)).toEqual(expect.arrayContaining(['manual', 'mock']));
		});
	});

	it('sort by amount', async () => {
		await inRollback(async (tx) => {
			const name = `Sort ${crypto.randomUUID()}`;
			await insertPayment(tx, { donorName: name, amountMinor: 900 });
			await insertPayment(tx, { donorName: name, amountMinor: 100 });
			const { rows } = await listPayments(tx, state({ q: name, sort: 'amount', dir: 'asc' }));
			expect(rows.map((r) => r.amountMinor)).toEqual([100, 900]);
		});
	});

	it('card: payer, purpose, membership, who confirmed, payload, history, refund mode', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const member = await insertUser(tx);
			const purpose = await addPurpose(tx);
			const payment = await insertPayment(tx, {
				kind: 'membership',
				userId: member.id,
				status: 'paid',
				paidAt: new Date(),
				confirmedBy: admin.id,
				donationPurposeId: purpose.id,
				providerPayload: { manual: { comment: 'Transfer' } }
			});
			const [membership] = await tx
				.insert(memberships)
				.values({ userId: member.id, status: 'active', paymentId: payment.id })
				.returning();
			await writeAudit(tx, {
				actorId: admin.id,
				action: 'payment.confirm_manual',
				entityType: 'payment',
				entityId: payment.id
			});
			const card = await getPaymentCard(tx, payment.id, () => manualProvider);
			expect(card).toMatchObject({
				id: payment.id,
				payerEmail: member.email,
				userId: member.id,
				purposeTitle: { en: 'Parkour park' },
				membership: { id: membership.id, status: 'active' },
				confirmedByName: expect.stringContaining('Test'),
				providerPayload: { manual: { comment: 'Transfer' } },
				refundMode: 'manual'
			});
			expect(card?.history.map((h) => h.action)).toEqual(['payment.confirm_manual']);
			expect(await getPaymentCard(tx, 'nope', () => null)).toBeNull();
			expect(await getPaymentCard(tx, crypto.randomUUID(), () => null)).toBeNull();
		});
	});
});
