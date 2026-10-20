import { afterAll, describe, expect, it } from 'vitest';
import { insertUser, testDb, testDbUrl } from '../../../db/test-db';
import { addPurpose } from '../../donations/test-support';
import { paymentsCsv, paymentsForExport } from './export';
import { insertPayment, staff } from './test-support';

/* docs/07 section 12 p. 4, docs/05 section 16: fees and donations in separate files for a period
 * of payment dates; only money that arrived (paid, later refunded); no formulas in cells. */

const day = (iso: string) => new Date(`${iso}T10:00:00+04:00`);
const PERIOD = { from: '2001-03-01', to: '2001-03-31' };

describe.skipIf(!testDbUrl)('admin payments: CSV export', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('donations of the period: paid and refunded, not pending, not fees, not other days', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const purpose = await addPurpose(tx);
			const paid = await insertPayment(tx, {
				status: 'paid',
				paidAt: day('2001-03-05'),
				amountMinor: 25_050,
				currency: 'USD',
				donationPurposeId: purpose.id,
				confirmedBy: admin.id,
				donorName: '=HYPERLINK("http://evil")'
			});
			const refunded = await insertPayment(tx, {
				status: 'refunded',
				paidAt: day('2001-03-31'),
				refundedAt: day('2001-04-02')
			});
			await insertPayment(tx, { status: 'pending' });
			await insertPayment(tx, { status: 'paid', paidAt: day('2001-04-01') });
			await insertPayment(tx, { kind: 'membership', status: 'paid', paidAt: day('2001-03-06') });

			const rows = await paymentsForExport(tx, { kind: 'donation', ...PERIOD });
			expect(rows.map((r) => r.id).sort()).toEqual([paid.id, refunded.id].sort());
			const csv = paymentsCsv('donation', rows);
			const [header, ...lines] = csv.trim().split('\r\n');
			expect(header).toBe(
				'paid_at,payment_id,status,payer_name,payer_email,amount,currency,provider,provider_payment_id,refunded_at,confirmed_by,purpose,is_anonymous'
			);
			expect(lines).toHaveLength(2);
			const line = lines.find((l) => l.includes(paid.id))!;
			expect(line).toContain(`"'=HYPERLINK(""http://evil"")"`);
			expect(line).toContain(',250.50,USD,manual,');
			expect(line).toContain('Parkour park');
			expect(line).not.toContain('=HYPERLINK("http');
		});
	});

	it('fees: member name and email from the account, no donation columns', async () => {
		await inRollback(async (tx) => {
			const member = await insertUser(tx);
			const fee = await insertPayment(tx, {
				kind: 'membership',
				userId: member.id,
				donorName: null,
				donorEmail: null,
				status: 'paid',
				paidAt: day('2001-03-10'),
				amountMinor: 20_000
			});
			const rows = await paymentsForExport(tx, { kind: 'membership', ...PERIOD });
			expect(rows.map((r) => r.id)).toEqual([fee.id]);
			const csv = paymentsCsv('membership', rows);
			const [header, line] = csv.trim().split('\r\n');
			expect(header.endsWith('confirmed_by')).toBe(true);
			expect(line).toContain(member.email);
			expect(line).toContain(',20000,AMD,');
		});
	});
});
