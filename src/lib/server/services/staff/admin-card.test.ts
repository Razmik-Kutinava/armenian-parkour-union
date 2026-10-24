import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { staffProfiles } from '../../db/schema/certification';
import { auditLog } from '../../db/schema/service';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { daysFrom, insertCertificate, insertStaff } from '../certificates/test-support';
import { getStaffCard, updateStaffProfile } from './admin-card';

/* docs/05 section 9: the card and the admin's corrections. docs/03 section 5: a profile is on only
 * with a live certificate of its kind — the form may switch it off, never on without one.
 * docs/04: `staff_profiles.write` (admin); the change goes to the audit log. */

const NOW = new Date();
const IP = '198.51.100.7';
const VALUES = {
	category: 'Category A',
	licenseNumber: 'LIC-9',
	bio: { en: 'Coach since 2015', ru: 'Тренер с 2015' },
	isPublic: true,
	isActive: true
};

async function setup(tx: LimitDb, cert: 'live' | 'expired' | 'none' = 'live') {
	const member = await insertUser(tx, { avatarKey: 'avatars/x/photo.webp', phone: '+37499000888' });
	const admin = await insertStaff(tx, 'admin');
	const certificate =
		cert === 'none'
			? null
			: await insertCertificate(tx, {
					userId: member.id,
					kind: 'judge',
					issuedBy: admin.id,
					issuedAt: daysFrom(NOW, -30),
					expiresAt: daysFrom(NOW, cert === 'live' ? 300 : -1)
				});
	const [profile] = await tx
		.insert(staffProfiles)
		.values({ userId: member.id, kind: 'judge', category: 'Old', isActive: cert === 'live' })
		.returning();
	return { member, admin, certificate, profile };
}

const row = async (tx: LimitDb, id: string) =>
	(await tx.select().from(staffProfiles).where(eq(staffProfiles.id, id)))[0];
const audit = (tx: LimitDb, id: string) =>
	tx
		.select()
		.from(auditLog)
		.where(and(eq(auditLog.entityId, id), eq(auditLog.action, 'staff_profile.update')));

describe.skipIf(!testDbUrl)('staff: admin card and update', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('card: member, photo key, kind, fields, live certificate; no contacts; bad id → null', async () => {
		await inRollback(async (tx) => {
			const { member, certificate, profile } = await setup(tx);
			const card = await getStaffCard(tx, profile.id, NOW);
			expect(card).toEqual({
				id: profile.id,
				userId: member.id,
				memberName: `Test ${member.tag}`,
				avatarKey: 'avatars/x/photo.webp',
				kind: 'judge',
				category: 'Old',
				licenseNumber: null,
				bio: null,
				isPublic: false,
				isActive: true,
				certificate: {
					id: certificate!.id,
					number: certificate!.number,
					expiresAt: certificate!.expiresAt
				}
			});
			expect(JSON.stringify(card)).not.toContain(member.email);
			expect(JSON.stringify(card)).not.toContain('+37499000888');
			expect(await getStaffCard(tx, 'not-a-uuid', NOW)).toBeNull();
			expect(await getStaffCard(tx, crypto.randomUUID(), NOW)).toBeNull();
		});
	});

	it('admin saves the fields; the audit log has what changed', async () => {
		await inRollback(async (tx) => {
			const { admin, profile } = await setup(tx);
			expect(await updateStaffProfile(tx, admin, profile.id, VALUES, IP, NOW)).toBe('ok');
			expect(await row(tx, profile.id)).toMatchObject(VALUES);
			const [entry] = await audit(tx, profile.id);
			expect(entry).toMatchObject({
				actorId: admin.id,
				entityType: 'staff_profile',
				ip: IP,
				before: { category: 'Old', licenseNumber: null, bio: null, isPublic: false },
				after: {
					category: 'Category A',
					licenseNumber: 'LIC-9',
					bio: VALUES.bio,
					isPublic: true
				}
			});
			expect(entry.before).not.toHaveProperty('isActive');
		});
	});

	it('nothing changed: ok and no audit entry', async () => {
		await inRollback(async (tx) => {
			const { admin, profile } = await setup(tx);
			const same = { ...VALUES, category: 'Old', licenseNumber: null, bio: null, isPublic: false };
			expect(await updateStaffProfile(tx, admin, profile.id, same, IP, NOW)).toBe('ok');
			expect(await audit(tx, profile.id)).toHaveLength(0);
		});
	});

	it('switching off is always allowed; on — only with a live certificate of the kind', async () => {
		await inRollback(async (tx) => {
			const { admin, profile } = await setup(tx);
			const off = { ...VALUES, isActive: false };
			expect(await updateStaffProfile(tx, admin, profile.id, off, IP, NOW)).toBe('ok');
			expect((await row(tx, profile.id)).isActive).toBe(false);
			expect(await updateStaffProfile(tx, admin, profile.id, VALUES, IP, NOW)).toBe('ok');
			expect((await row(tx, profile.id)).isActive).toBe(true);
		});
		for (const cert of ['expired', 'none'] as const) {
			await inRollback(async (tx) => {
				const { admin, member, profile } = await setup(tx, cert);
				await insertCertificate(tx, { userId: member.id, kind: 'trainer', issuedBy: admin.id });
				expect(await updateStaffProfile(tx, admin, profile.id, VALUES, IP, NOW)).toBe(
					'no_live_certificate'
				);
				expect(await row(tx, profile.id)).toMatchObject({ isActive: false, category: 'Old' });
				expect(await audit(tx, profile.id)).toHaveLength(0);
				const hidden = { ...VALUES, isActive: false };
				expect(await updateStaffProfile(tx, admin, profile.id, hidden, IP, NOW)).toBe('ok');
				expect(await row(tx, profile.id)).toMatchObject({ isActive: false, category: 'Category A' });
			});
		}
	});

	it('moderator and editor may not; an unknown profile is not found', async () => {
		await inRollback(async (tx) => {
			const { profile } = await setup(tx);
			for (const role of ['moderator', 'editor'] as const) {
				const actor = await insertStaff(tx, role);
				expect(await updateStaffProfile(tx, actor, profile.id, VALUES, IP, NOW)).toBe(
					'not_allowed'
				);
			}
			expect(await row(tx, profile.id)).toMatchObject({ category: 'Old', isPublic: false });
			const admin = await insertStaff(tx, 'admin');
			for (const id of ['x', crypto.randomUUID()]) {
				expect(await updateStaffProfile(tx, admin, id, VALUES, IP, NOW)).toBe('not_found');
			}
		});
	});
});
