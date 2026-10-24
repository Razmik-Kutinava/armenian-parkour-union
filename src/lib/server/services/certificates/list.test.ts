import { afterAll, describe, expect, it } from 'vitest';
import type { ListState } from '#lib/components/admin/list-state.ts';
import { testDb, testDbUrl } from '../../db/test-db';
import { insertMember } from '../registrations/test-support';
import { certificateListOptions, listCertificates } from './list';
import { daysFrom, insertCertificate, insertStaff } from './test-support';

/* docs/05 section 8: number, member, type, level or category, issued, valid until, state; filters
 * type, state, expiring within 60 days. docs/04 section 4: no member contacts; email search — admin. */

const NOW = new Date();
const state = (q: string, filters: Record<string, string> = {}): ListState => ({
	page: 1,
	sort: certificateListOptions.defaultSort.key,
	dir: certificateListOptions.defaultSort.dir,
	q,
	filters
});
const revoked = { status: 'revoked' as const, revokedAt: NOW, revokeReason: 'Test' };

describe.skipIf(!testDbUrl)('certificates: admin list', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('shows number, member, type, level or category, dates and state; no contacts', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx);
			const moderator = await insertStaff(tx);
			const cert = await insertCertificate(tx, {
				userId: member.id,
				kind: 'trainer',
				category: 'Category B',
				issuedBy: member.id,
				issuedAt: daysFrom(NOW, -10),
				expiresAt: daysFrom(NOW, 700)
			});
			const { rows, total } = await listCertificates(tx, moderator, state(member.tag), NOW);
			expect(total).toBe(1);
			expect(rows[0]).toEqual({
				id: cert.id,
				number: cert.number,
				userId: member.id,
				memberName: `Test ${member.tag}`,
				kind: 'trainer',
				level: null,
				category: 'Category B',
				issuedAt: cert.issuedAt,
				expiresAt: cert.expiresAt,
				state: 'active'
			});
			expect(JSON.stringify(rows)).not.toContain(member.email);
		});
	});

	it('filters by type, state (a passed expiry is expired) and expiring within 60 days', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx);
			const admin = await insertStaff(tx, 'admin');
			const base = { userId: member.id, issuedBy: admin.id };
			const soon = await insertCertificate(tx, {
				...base,
				kind: 'trainer',
				issuedAt: daysFrom(NOW, -1),
				expiresAt: daysFrom(NOW, 30)
			});
			const later = await insertCertificate(tx, {
				...base,
				kind: 'judge',
				issuedAt: daysFrom(NOW, -2),
				expiresAt: daysFrom(NOW, 100)
			});
			const lapsed = await insertCertificate(tx, {
				...base,
				kind: 'judge',
				issuedAt: daysFrom(NOW, -3),
				expiresAt: daysFrom(NOW, -1)
			});
			const marked = await insertCertificate(tx, {
				...base,
				kind: 'trainer',
				status: 'expired',
				issuedAt: daysFrom(NOW, -4),
				expiresAt: daysFrom(NOW, -2)
			});
			const pro = await insertCertificate(tx, {
				...base,
				kind: 'level',
				level: 'pro',
				issuedAt: daysFrom(NOW, -5)
			});
			const gone = await insertCertificate(tx, {
				...base,
				kind: 'level',
				level: 'advanced',
				issuedAt: daysFrom(NOW, -6),
				...revoked
			});
			const ids = async (filters: Record<string, string>) =>
				(await listCertificates(tx, admin, state(member.tag, filters), NOW)).rows.map((r) => r.id);

			expect(await ids({})).toEqual([soon, later, lapsed, marked, pro, gone].map((c) => c.id));
			expect(await ids({ kind: 'judge' })).toEqual([later.id, lapsed.id]);
			expect(await ids({ kind: 'level_pro' })).toEqual([pro.id]);
			expect(await ids({ state: 'active' })).toEqual([soon.id, later.id, pro.id]);
			expect(await ids({ state: 'expired' })).toEqual([lapsed.id, marked.id]);
			expect(await ids({ state: 'revoked' })).toEqual([gone.id]);
			expect(await ids({ expiring: '60' })).toEqual([soon.id]);
			expect(await ids({ kind: 'x', state: 'x', expiring: 'x' })).toHaveLength(6);
			const rows = (await listCertificates(tx, admin, state(member.tag), NOW)).rows;
			expect(rows.map((r) => r.state)).toEqual([
				'active',
				'active',
				'expired',
				'expired',
				'active',
				'revoked'
			]);
		});
	});

	it('sorts by expiry on request, certificates without one last', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx);
			const admin = await insertStaff(tx, 'admin');
			const base = { userId: member.id, issuedBy: admin.id };
			const level = await insertCertificate(tx, { ...base, kind: 'level', level: 'advanced' });
			const far = await insertCertificate(tx, {
				...base,
				kind: 'judge',
				expiresAt: daysFrom(NOW, 300)
			});
			const near = await insertCertificate(tx, {
				...base,
				kind: 'trainer',
				expiresAt: daysFrom(NOW, 10)
			});
			const byExpiry = { ...state(member.tag), sort: 'expiresAt', dir: 'asc' as const };
			const rows = (await listCertificates(tx, admin, byExpiry, NOW)).rows;
			expect(rows.map((r) => r.id)).toEqual([near.id, far.id, level.id]);
		});
	});

	it('finds by number; by email only for an admin; staff without the right get nothing', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx);
			const admin = await insertStaff(tx, 'admin');
			const moderator = await insertStaff(tx);
			const editor = await insertStaff(tx, 'editor');
			const cert = await insertCertificate(tx, {
				userId: member.id,
				kind: 'judge',
				issuedBy: admin.id
			});

			expect((await listCertificates(tx, moderator, state(cert.number), NOW)).total).toBe(1);
			expect((await listCertificates(tx, admin, state(member.email), NOW)).total).toBe(1);
			expect((await listCertificates(tx, moderator, state(member.email), NOW)).total).toBe(0);
			expect(await listCertificates(tx, editor, state(member.tag), NOW)).toEqual({
				rows: [],
				total: 0
			});
		});
	});
});
