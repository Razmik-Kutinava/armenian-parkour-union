import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { partnerCashiers } from '../../db/schema/volunteer-partners';
import { testDb, testDbUrl } from '../../db/test-db';
import { bindCashier, cashierInviteUrl, findCashier, findInvite } from './cashier-access';
import { createCashier, disableCashier } from './cashiers-admin';
import { createPartner } from './partners-admin';
import { partnerValues, staff } from './test-support';
import type { LimitDb } from '../../auth/rate-limit';

/* docs/03 section 19.4 items 1–2, docs/04 sections 2 and 8: the invite link binds one phone once,
 * not after its hours and not when disabled; only SHA-256 hashes of both tokens are stored. */

const HOUR = 3_600_000;
const sha = (value: string) => createHash('sha256').update(value).digest('hex');

async function invite(tx: LimitDb, label = 'Till 1') {
	const admin = await staff(tx);
	const partner = await createPartner(tx, admin, partnerValues({ name: 'Komitas Coffee' }), null);
	if (typeof partner === 'string') throw new Error(partner);
	const created = await createCashier(tx, admin, partner.id, label, null);
	if (typeof created === 'string') throw new Error(created);
	return { admin, partnerId: partner.id, ...created };
}

const row = async (tx: LimitDb, id: string) =>
	(await tx.select().from(partnerCashiers).where(eq(partnerCashiers.id, id)))[0];

describe.skipIf(!testDbUrl)('cashier phone binding', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('the link binds the phone once: the device token is returned, only its hash stored', async () => {
		await inRollback(async (tx) => {
			const { id, token, partnerId } = await invite(tx);
			expect(await findInvite(tx, token)).toEqual({ partnerName: 'Komitas Coffee', label: 'Till 1' });
			const device = await bindCashier(tx, token);
			expect(device).toMatch(/^[A-Za-z0-9_-]{43}$/);
			const bound = await row(tx, id);
			expect(bound).toMatchObject({ inviteTokenHash: null, deviceTokenHash: sha(device!) });
			expect(bound.boundAt).toBeInstanceOf(Date);
			expect(await findCashier(tx, device)).toEqual({
				id,
				partnerId,
				partnerName: 'Komitas Coffee',
				label: 'Till 1'
			});
			expect(await bindCashier(tx, token)).toBeNull();
			expect(await findInvite(tx, token)).toBeNull();
		});
	});

	it('not after its hours, not when disabled; a disabled phone is not a cashier', async () => {
		await inRollback(async (tx) => {
			const late = await invite(tx);
			const after = new Date(late.expiresAt.getTime() + 1000);
			expect(await findInvite(tx, late.token, after)).toBeNull();
			expect(await bindCashier(tx, late.token, after)).toBeNull();
			expect((await row(tx, late.id)).deviceTokenHash).toBeNull();

			const off = await invite(tx);
			expect(await disableCashier(tx, off.admin, off.partnerId, off.id, null)).toBe('ok');
			expect(await findInvite(tx, off.token)).toBeNull();
			expect(await bindCashier(tx, off.token)).toBeNull();

			const used = await invite(tx);
			const device = await bindCashier(tx, used.token, new Date(Date.now() + HOUR));
			expect(await findCashier(tx, device)).not.toBeNull();
			expect(await disableCashier(tx, used.admin, used.partnerId, used.id, null)).toBe('ok');
			expect(await findCashier(tx, device)).toBeNull();
		});
	});

	it('unknown or broken tokens: nothing found, nothing bound', async () => {
		await inRollback(async (tx) => {
			await invite(tx);
			for (const token of ['', 'nope', 'a'.repeat(43), 'é'.repeat(43), 'a'.repeat(500)]) {
				expect(await findInvite(tx, token)).toBeNull();
				expect(await bindCashier(tx, token)).toBeNull();
				expect(await findCashier(tx, token)).toBeNull();
			}
			expect(await findCashier(tx, undefined)).toBeNull();
		});
	});

	it('the invite link opens the Armenian page, like the QR', () => {
		expect(cashierInviteUrl('https://parkour.am/', 'abc')).toBe(
			'https://parkour.am/hy/partner/join/abc'
		);
	});
});
