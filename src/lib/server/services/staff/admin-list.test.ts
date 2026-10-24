import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { ListState } from '#lib/components/admin/list-state.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { staffProfiles } from '../../db/schema/certification';
import { users } from '../../db/schema/users';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { daysFrom, insertCertificate, insertStaff } from '../certificates/test-support';
import { listStaffProfiles, staffListOptions } from './admin-list';

/* docs/05 section 9: member, kind, category, license, certificate, public, active; filters kind,
 * active, public. docs/04: moderator and admin read; no member contacts; email search — admin. */

const NOW = new Date();
const state = (q: string, filters: Record<string, string> = {}): ListState => ({
	page: 1,
	sort: staffListOptions.defaultSort.key,
	dir: staffListOptions.defaultSort.dir,
	q,
	filters
});

type Profile = Partial<typeof staffProfiles.$inferInsert> & { userId: string };
async function profile(tx: LimitDb, values: Profile) {
	const [row] = await tx
		.insert(staffProfiles)
		.values({ kind: 'trainer', ...values })
		.returning();
	return row;
}

describe.skipIf(!testDbUrl)('staff: admin list', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('shows member, kind, category, license, live certificate, public, active; no contacts', async () => {
		await inRollback(async (tx) => {
			const tag = crypto.randomUUID();
			const member = await insertUser(tx, { name: `Coach ${tag}`, phone: '+37499000777' });
			const moderator = await insertStaff(tx);
			await insertCertificate(tx, {
				userId: member.id,
				kind: 'trainer',
				issuedBy: moderator.id,
				issuedAt: daysFrom(NOW, -900),
				expiresAt: daysFrom(NOW, -10)
			});
			const live = await insertCertificate(tx, {
				userId: member.id,
				kind: 'trainer',
				issuedBy: moderator.id,
				issuedAt: daysFrom(NOW, -5),
				expiresAt: daysFrom(NOW, 700)
			});
			const p = await profile(tx, {
				userId: member.id,
				category: 'Category B',
				licenseNumber: 'LIC-1',
				isPublic: true
			});
			const { rows, total } = await listStaffProfiles(tx, moderator, state(tag), NOW);
			expect(total).toBe(1);
			expect(rows[0]).toEqual({
				id: p.id,
				userId: member.id,
				memberName: `Coach ${tag}`,
				kind: 'trainer',
				category: 'Category B',
				licenseNumber: 'LIC-1',
				certificateId: live.id,
				certificateNumber: live.number,
				isPublic: true,
				isActive: true
			});
			expect(JSON.stringify(rows)).not.toContain(member.email);
			expect(JSON.stringify(rows)).not.toContain('+37499000777');
		});
	});

	it('no live certificate of the same kind: the column is empty', async () => {
		await inRollback(async (tx) => {
			const member = await insertUser(tx);
			const admin = await insertStaff(tx, 'admin');
			await insertCertificate(tx, { userId: member.id, kind: 'judge', issuedBy: admin.id });
			await insertCertificate(tx, {
				userId: member.id,
				kind: 'trainer',
				issuedBy: admin.id,
				status: 'revoked',
				revokedAt: NOW,
				revokeReason: 'Test'
			});
			await profile(tx, { userId: member.id, isActive: false });
			const [row] = (await listStaffProfiles(tx, admin, state(member.tag), NOW)).rows;
			expect(row).toMatchObject({ certificateId: null, certificateNumber: null });
		});
	});

	it('filters by kind, active and public; sorts by name; deleted members are left out', async () => {
		await inRollback(async (tx) => {
			const tag = crypto.randomUUID();
			const admin = await insertStaff(tx, 'admin');
			const person = (first: string) => insertUser(tx, { name: `${first} ${tag}` });
			const ann = await person('Ann');
			const ben = await person('Ben');
			const cid = await person('Cid');
			const gone = await person('Dan');
			await tx.update(users).set({ deletedAt: NOW }).where(eq(users.id, gone.id));
			const annT = await profile(tx, { userId: ann.id, isPublic: true });
			const annJ = await profile(tx, { userId: ann.id, kind: 'judge', isActive: false });
			const benJ = await profile(tx, { userId: ben.id, kind: 'judge', isPublic: true });
			const cidT = await profile(tx, { userId: cid.id, isActive: false });
			await profile(tx, { userId: gone.id });
			const ids = async (filters: Record<string, string>) =>
				(await listStaffProfiles(tx, admin, state(tag, filters), NOW)).rows.map((r) => r.id);

			expect(await ids({})).toEqual([annT.id, annJ.id, benJ.id, cidT.id]);
			expect(await ids({ kind: 'judge' })).toEqual([annJ.id, benJ.id]);
			expect(await ids({ active: 'yes' })).toEqual([annT.id, benJ.id]);
			expect(await ids({ active: 'no' })).toEqual([annJ.id, cidT.id]);
			expect(await ids({ public: 'yes' })).toEqual([annT.id, benJ.id]);
			expect(await ids({ public: 'no', kind: 'trainer' })).toEqual([cidT.id]);
			expect(await ids({ kind: 'x', active: 'x', public: 'x' })).toHaveLength(4);
			const desc = { ...state(tag), dir: 'desc' as const };
			const rows = (await listStaffProfiles(tx, admin, desc, NOW)).rows;
			expect(rows.map((r) => r.memberName)).toEqual([
				`Cid ${tag}`,
				`Ben ${tag}`,
				`Ann ${tag}`,
				`Ann ${tag}`
			]);
		});
	});

	it('finds by license; by email only for an admin; staff without the right get nothing', async () => {
		await inRollback(async (tx) => {
			const member = await insertUser(tx);
			const admin = await insertStaff(tx, 'admin');
			const moderator = await insertStaff(tx);
			const editor = await insertStaff(tx, 'editor');
			const license = `LIC-${crypto.randomUUID()}`;
			await profile(tx, { userId: member.id, licenseNumber: license });

			expect((await listStaffProfiles(tx, moderator, state(license), NOW)).total).toBe(1);
			expect((await listStaffProfiles(tx, admin, state(member.email), NOW)).total).toBe(1);
			expect((await listStaffProfiles(tx, moderator, state(member.email), NOW)).total).toBe(0);
			expect(await listStaffProfiles(tx, editor, state(member.tag), NOW)).toEqual({
				rows: [],
				total: 0
			});
		});
	});
});
