import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { testDb, testDbUrl } from '../../db/test-db';
import { auditFor } from '../memberships/test-support';
import type { Actor } from '../users/target';
import { createPartner } from './partners-admin';
import { createPerk, getPerk, listPerks, updatePerk } from './perks-admin';
import { partnerValues, perkValues, staff } from './test-support';

/* docs/05 section 28 "Perks" tab: title and terms ×3, reusable or single with a limit, dates,
 * status, order; never deleted. docs/03 section 19.9: creation and edits are audited. */

async function newPartner(tx: LimitDb, actor: Actor) {
	const created = await createPartner(tx, actor, partnerValues(), null);
	if (typeof created === 'string') throw new Error(created);
	return created.id;
}

describe.skipIf(!testDbUrl)('volunteer perks in the admin panel', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('create a single perk, list in order, then make it reusable: the change only is audited', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const partnerId = await newPartner(tx, admin);
			const single = perkValues({
				kind: 'single',
				usesLimit: 2,
				terms: { en: 'Show the QR' },
				validFrom: '2026-11-01',
				validUntil: '2026-12-31',
				sortOrder: 2
			});
			const first = await createPerk(tx, admin, partnerId, single, '10.0.0.9');
			const second = await createPerk(tx, admin, partnerId, perkValues({ sortOrder: 1 }), null);
			if (typeof first === 'string' || typeof second === 'string') throw new Error('refused');
			expect(await getPerk(tx, partnerId, first.id)).toMatchObject(single);
			expect((await listPerks(tx, partnerId)).map((p) => p.id)).toEqual([second.id, first.id]);
			const reusable = { ...single, kind: 'reusable' as const, usesLimit: null };
			expect(await updatePerk(tx, admin, partnerId, first.id, reusable, null)).toBe('ok');
			expect(await updatePerk(tx, admin, partnerId, first.id, reusable, null)).toBe('ok');
			expect(await auditFor(tx, 'volunteer_perk', first.id)).toMatchObject([
				{
					actorId: admin.id,
					action: 'volunteer_perk.create',
					after: { partnerId, kind: 'single', usesLimit: 2 },
					ip: '10.0.0.9'
				},
				{
					action: 'volunteer_perk.update',
					before: { kind: 'single', usesLimit: 2 },
					after: { kind: 'reusable', usesLimit: null }
				}
			]);
		});
	});

	it('a perk is reached only through its own partner', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const own = await newPartner(tx, admin);
			const other = await newPartner(tx, admin);
			const perk = await createPerk(tx, admin, own, perkValues(), null);
			if (typeof perk === 'string') throw new Error(perk);
			const values = perkValues({ status: 'published' });
			expect(await getPerk(tx, other, perk.id)).toBeNull();
			expect(await updatePerk(tx, admin, other, perk.id, values, null)).toBe('not_found');
			expect(await listPerks(tx, other)).toEqual([]);
			expect((await getPerk(tx, own, perk.id))?.status).toBe('draft');
		});
	});

	it('refusals: not an admin, unknown partner or perk', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const partnerId = await newPartner(tx, admin);
			const perk = await createPerk(tx, admin, partnerId, perkValues(), null);
			if (typeof perk === 'string') throw new Error(perk);
			for (const role of ['moderator', 'editor'] as const) {
				const actor = await staff(tx, role);
				expect(await createPerk(tx, actor, partnerId, perkValues(), null)).toBe('not_allowed');
				expect(await updatePerk(tx, actor, partnerId, perk.id, perkValues(), null)).toBe(
					'not_allowed'
				);
			}
			const unknown = crypto.randomUUID();
			expect(await createPerk(tx, admin, unknown, perkValues(), null)).toBe('not_found');
			expect(await createPerk(tx, admin, 'nope', perkValues(), null)).toBe('not_found');
			expect(await updatePerk(tx, admin, partnerId, unknown, perkValues(), null)).toBe('not_found');
			expect(await updatePerk(tx, admin, partnerId, 'nope', perkValues(), null)).toBe('not_found');
			expect(await getPerk(tx, partnerId, 'nope')).toBeNull();
			expect(await listPerks(tx, 'nope')).toEqual([]);
		});
	});
});
