import { afterAll, describe, expect, it } from 'vitest';
import { testDb, testDbUrl } from '../../db/test-db';
import { auditFor } from '../memberships/test-support';
import { insertPayment, staff } from '../payments/admin/test-support';
import { listActivePurposes } from './purposes';
import { createPurpose, getPurpose, listPurposesAdmin, updatePurpose } from './purposes-admin';

/* docs/05 section 17: title ×3, active, order; hidden instead of deleted (payments point to it);
 * the list shows what was collected for each purpose. */

const values = (extra = {}) => ({
	title: { en: 'Training hall', ru: 'Зал' },
	isActive: true,
	sortOrder: 5,
	...extra
});

describe.skipIf(!testDbUrl)('donations: purposes in the admin panel', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('create, then hide: gone from /donate, kept in the admin list; both audited', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const created = await createPurpose(tx, admin, values(), '10.0.0.2');
			if (typeof created === 'string') throw new Error(created);
			expect(await getPurpose(tx, created.id)).toMatchObject(values());
			expect((await listActivePurposes(tx, 'ru')).map((p) => p.title)).toContain('Зал');
			const result = await updatePurpose(tx, admin, created.id, values({ isActive: false }), null);
			expect(result).toBe('ok');
			expect((await listActivePurposes(tx, 'en')).map((p) => p.id)).not.toContain(created.id);
			expect((await listPurposesAdmin(tx)).map((p) => p.id)).toContain(created.id);
			expect(await auditFor(tx, 'donation_purpose', created.id)).toMatchObject([
				{ actorId: admin.id, action: 'donation_purpose.create', ip: '10.0.0.2' },
				{
					actorId: admin.id,
					action: 'donation_purpose.update',
					before: { isActive: true },
					after: { isActive: false }
				}
			]);
		});
	});

	it('collected: only paid donations, per currency', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const created = await createPurpose(tx, admin, values(), null);
			if (typeof created === 'string') throw new Error(created);
			const paidAt = new Date();
			const purpose = { donationPurposeId: created.id };
			await insertPayment(tx, { ...purpose, status: 'paid', paidAt, amountMinor: 1000 });
			await insertPayment(tx, { ...purpose, status: 'paid', paidAt, amountMinor: 2500 });
			await insertPayment(tx, { ...purpose, status: 'paid', paidAt, amountMinor: 700, currency: 'USD' });
			await insertPayment(tx, { ...purpose, status: 'refunded', paidAt, amountMinor: 9000 });
			await insertPayment(tx, { ...purpose, status: 'pending', amountMinor: 9000 });
			const row = (await listPurposesAdmin(tx)).find((p) => p.id === created.id);
			expect(row?.collected).toEqual([
				{ currency: 'AMD', amountMinor: 3500 },
				{ currency: 'USD', amountMinor: 700 }
			]);
		});
	});

	it('refusals: not an admin, unknown purpose', async () => {
		await inRollback(async (tx) => {
			const moderator = await staff(tx, 'moderator');
			expect(await createPurpose(tx, moderator, values(), null)).toBe('not_allowed');
			const admin = await staff(tx);
			expect(await updatePurpose(tx, admin, crypto.randomUUID(), values(), null)).toBe('not_found');
			expect(await updatePurpose(tx, admin, 'nope', values(), null)).toBe('not_found');
			expect(await getPurpose(tx, 'nope')).toBeNull();
		});
	});
});
