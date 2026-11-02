import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { siteSettings } from '../../db/schema/service';
import { testDb, testDbUrl } from '../../db/test-db';
import { auditFor } from '../memberships/test-support';
import { bindCashier, findCashier } from './cashier-access';
import { createCashier, disableCashier, listCashiers, newCashierLink } from './cashiers-admin';
import { createPartner } from './partners-admin';
import { partnerValues, staff } from './test-support';

/* docs/05 section 28 "Cashiers": create an access, a new link (the old phone stops working),
 * disable; the link is shown once and only its hash is stored. docs/03 section 19.9 — all three go
 * to the journal without the token. */

const HOUR = 3_600_000;

async function partnerOf(tx: LimitDb) {
	const admin = await staff(tx);
	const partner = await createPartner(tx, admin, partnerValues(), null);
	if (typeof partner === 'string') throw new Error(partner);
	return { admin, partnerId: partner.id };
}

describe.skipIf(!testDbUrl)('cashier accesses in the admin panel', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('create: waiting until now + 72 h, the token is returned once and never logged', async () => {
		await inRollback(async (tx) => {
			const { admin, partnerId } = await partnerOf(tx);
			const now = new Date('2026-11-02T10:00:00Z');
			const created = await createCashier(
				tx,
				admin,
				partnerId,
				'  Till 1, Komitas ',
				'10.0.0.9',
				now
			);
			if (typeof created === 'string') throw new Error(created);
			expect(created.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
			expect(created.expiresAt).toEqual(new Date(now.getTime() + 72 * HOUR));
			expect(await listCashiers(tx, partnerId, now)).toEqual([
				{
					id: created.id,
					label: 'Till 1, Komitas',
					state: 'waiting',
					inviteExpiresAt: created.expiresAt,
					boundAt: null,
					lastUsedAt: null,
					disabledAt: null
				}
			]);
			const after = new Date(created.expiresAt.getTime() + 1);
			expect((await listCashiers(tx, partnerId, after))[0].state).toBe('expired');
			const audit = await auditFor(tx, 'partner_cashier', created.id);
			expect(audit).toMatchObject([
				{
					actorId: admin.id,
					action: 'partner_cashier.create',
					ip: '10.0.0.9',
					after: { partnerId, label: 'Till 1, Komitas' }
				}
			]);
			expect(JSON.stringify(audit)).not.toContain(created.token);
		});
	});

	it('the link lives as many hours as the settings say', async () => {
		await inRollback(async (tx) => {
			const value = { cashier_invite_hours: 5 };
			await tx
				.insert(siteSettings)
				.values({ key: 'volunteer', value })
				.onConflictDoUpdate({ target: siteSettings.key, set: { value } });
			const { admin, partnerId } = await partnerOf(tx);
			const now = new Date();
			const created = await createCashier(tx, admin, partnerId, 'Till', null, now);
			if (typeof created === 'string') throw new Error(created);
			expect(created.expiresAt).toEqual(new Date(now.getTime() + 5 * HOUR));
		});
	});

	it('a new link to a bound access: the old phone stops, the new link binds', async () => {
		await inRollback(async (tx) => {
			const { admin, partnerId } = await partnerOf(tx);
			const created = await createCashier(tx, admin, partnerId, 'Till', null);
			if (typeof created === 'string') throw new Error(created);
			const oldPhone = await bindCashier(tx, created.token);
			expect((await listCashiers(tx, partnerId))[0].state).toBe('bound');

			const link = await newCashierLink(tx, admin, partnerId, created.id, null);
			if (typeof link === 'string') throw new Error(link);
			expect(link.token).not.toBe(created.token);
			expect(await findCashier(tx, oldPhone)).toBeNull();
			expect((await listCashiers(tx, partnerId))[0]).toMatchObject({
				state: 'waiting',
				boundAt: null
			});
			expect(await bindCashier(tx, created.token)).toBeNull();
			const newPhone = await bindCashier(tx, link.token);
			expect((await findCashier(tx, newPhone))?.id).toBe(created.id);
			const audit = await auditFor(tx, 'partner_cashier', created.id);
			expect(audit.map((a) => a.action)).toEqual([
				'partner_cashier.create',
				'partner_cashier.relink'
			]);
			expect(JSON.stringify(audit)).not.toContain(link.token);
		});
	});

	it('disable is final: no new link; a second disable writes nothing', async () => {
		await inRollback(async (tx) => {
			const { admin, partnerId } = await partnerOf(tx);
			const created = await createCashier(tx, admin, partnerId, 'Till', null);
			if (typeof created === 'string') throw new Error(created);
			expect(await disableCashier(tx, admin, partnerId, created.id, null)).toBe('ok');
			expect(await disableCashier(tx, admin, partnerId, created.id, null)).toBe('ok');
			expect(await newCashierLink(tx, admin, partnerId, created.id, null)).toBe('disabled');
			const [listed] = await listCashiers(tx, partnerId);
			expect(listed.state).toBe('disabled');
			expect(listed.disabledAt).toBeInstanceOf(Date);
			const audit = await auditFor(tx, 'partner_cashier', created.id);
			expect(audit.map((a) => a.action)).toEqual([
				'partner_cashier.create',
				'partner_cashier.disable'
			]);
		});
	});

	it('refusals: not an admin, a bad label, a foreign or unknown partner or access', async () => {
		await inRollback(async (tx) => {
			const { admin, partnerId } = await partnerOf(tx);
			const other = await partnerOf(tx);
			for (const role of ['moderator', 'editor', 'member'] as const) {
				const actor = await staff(tx, role);
				expect(await createCashier(tx, actor, partnerId, 'Till', null)).toBe('not_allowed');
			}
			for (const label of ['', '   ', 'x'.repeat(81)]) {
				expect(await createCashier(tx, admin, partnerId, label, null)).toBe('bad_label');
			}
			expect(await createCashier(tx, admin, crypto.randomUUID(), 'Till', null)).toBe('not_found');
			expect(await createCashier(tx, admin, 'nope', 'Till', null)).toBe('not_found');

			const created = await createCashier(tx, admin, partnerId, 'Till', null);
			if (typeof created === 'string') throw new Error(created);
			const moderator = await staff(tx, 'moderator');
			expect(await newCashierLink(tx, moderator, partnerId, created.id, null)).toBe('not_allowed');
			expect(await disableCashier(tx, moderator, partnerId, created.id, null)).toBe('not_allowed');
			for (const [partner, id] of [
				[other.partnerId, created.id],
				[partnerId, crypto.randomUUID()],
				[partnerId, 'nope']
			]) {
				expect(await newCashierLink(tx, admin, partner, id, null)).toBe('not_found');
				expect(await disableCashier(tx, admin, partner, id, null)).toBe('not_found');
			}
			expect(await listCashiers(tx, other.partnerId)).toEqual([]);
			expect(await listCashiers(tx, 'nope')).toEqual([]);
			expect((await listCashiers(tx, partnerId))[0].state).toBe('waiting');
			expect(await auditFor(tx, 'partner_cashier', created.id)).toHaveLength(1);
		});
	});
});
