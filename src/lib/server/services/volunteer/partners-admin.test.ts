import { afterAll, describe, expect, it } from 'vitest';
import { testDb, testDbUrl } from '../../db/test-db';
import { findUsages } from '../media/usage';
import { auditFor } from '../memberships/test-support';
import { createPartner, getPartner, updatePartner } from './partners-admin';
import { insertMedia, partnerValues, staff } from './test-support';

/* docs/05 section 28 "Partners": form, status, logo from the library; docs/03 section 19.9 —
 * creation, edits and status changes go to the journal. Never deleted: archived. */

describe.skipIf(!testDbUrl)('volunteer partners in the admin panel', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('create with a logo, then publish: stored as sent, both audited with the change only', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const logoKey = await insertMedia(tx, admin.id);
			const values = partnerValues({
				logoKey,
				website: 'https://coffee.am',
				address: { en: 'Abovyan 1' }
			});
			const created = await createPartner(tx, admin, values, '10.0.0.7');
			if (typeof created === 'string') throw new Error(created);
			expect(await getPartner(tx, created.id)).toMatchObject(values);
			const published = { ...values, status: 'published' as const };
			expect(await updatePartner(tx, admin, created.id, published, null)).toBe('ok');
			expect(await updatePartner(tx, admin, created.id, published, null)).toBe('ok');
			expect(await auditFor(tx, 'volunteer_partner', created.id)).toMatchObject([
				{ actorId: admin.id, action: 'volunteer_partner.create', ip: '10.0.0.7' },
				{
					action: 'volunteer_partner.update',
					before: { status: 'draft' },
					after: { status: 'published' }
				}
			]);
			expect(await findUsages(tx, logoKey)).toEqual([
				{ kind: 'volunteer_partner', id: created.id }
			]);
		});
	});

	it('archived instead of deleted: the logo stays in use', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const logoKey = await insertMedia(tx, admin.id);
			const created = await createPartner(tx, admin, partnerValues({ logoKey }), null);
			if (typeof created === 'string') throw new Error(created);
			const archived = partnerValues({ logoKey, status: 'archived' });
			expect(await updatePartner(tx, admin, created.id, archived, null)).toBe('ok');
			expect((await getPartner(tx, created.id))?.status).toBe('archived');
			expect(await findUsages(tx, logoKey)).toHaveLength(1);
		});
	});

	it('logo: only a library image that is not deleted', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const pdf = await insertMedia(tx, admin.id, { mime: 'application/pdf' });
			const gone = await insertMedia(tx, admin.id, { deleted: true });
			const missing = `media/2026/10/${crypto.randomUUID()}.png`;
			for (const logoKey of [pdf, gone, missing]) {
				expect(await createPartner(tx, admin, partnerValues({ logoKey }), null)).toBe('bad_logo');
			}
			const created = await createPartner(tx, admin, partnerValues(), null);
			if (typeof created === 'string') throw new Error(created);
			const update = partnerValues({ logoKey: pdf });
			expect(await updatePartner(tx, admin, created.id, update, null)).toBe('bad_logo');
			expect(await auditFor(tx, 'volunteer_partner', created.id)).toHaveLength(1);
		});
	});

	it('refusals: not an admin, unknown partner', async () => {
		await inRollback(async (tx) => {
			for (const role of ['moderator', 'editor', 'member'] as const) {
				const actor = await staff(tx, role);
				expect(await createPartner(tx, actor, partnerValues(), null)).toBe('not_allowed');
			}
			const admin = await staff(tx);
			const created = await createPartner(tx, admin, partnerValues(), null);
			if (typeof created === 'string') throw new Error(created);
			const moderator = await staff(tx, 'moderator');
			const values = partnerValues({ status: 'published' });
			expect(await updatePartner(tx, moderator, created.id, values, null)).toBe('not_allowed');
			expect(await updatePartner(tx, admin, crypto.randomUUID(), values, null)).toBe('not_found');
			expect(await updatePartner(tx, admin, 'nope', values, null)).toBe('not_found');
			expect(await getPartner(tx, 'nope')).toBeNull();
			expect((await getPartner(tx, created.id))?.status).toBe('draft');
		});
	});
});
