import { afterAll, describe, expect, it } from 'vitest';
import { session } from '../../db/schema/auth';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { findMembers, listStaff } from './staff';

describe.skipIf(!testDbUrl)('admins and roles (docs/05 section 23)', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('lists editors, moderators and admins with the last sign-in', async () => {
		await inRollback(async (tx) => {
			const editor = await insertUser(tx, { role: 'editor' });
			const member = await insertUser(tx);
			const blocked = await insertUser(tx, { role: 'moderator', status: 'blocked' });
			const gone = await insertUser(tx, { role: 'admin', deletedAt: new Date() });
			const old = new Date('2026-01-01T10:00:00Z');
			const recent = new Date('2026-10-01T10:00:00Z');
			const expiresAt = new Date(Date.now() + 3_600_000);
			await tx.insert(session).values([
				{ userId: editor.id, token: crypto.randomUUID(), expiresAt, createdAt: old },
				{ userId: editor.id, token: crypto.randomUUID(), expiresAt, createdAt: recent }
			]);
			const staff = await listStaff(tx);
			const ids = staff.map((s) => s.id);
			expect(ids).toContain(editor.id);
			expect(ids).toContain(blocked.id);
			expect(ids).not.toContain(member.id);
			expect(ids).not.toContain(gone.id);
			const row = staff.find((s) => s.id === editor.id);
			expect(row).toMatchObject({ role: 'editor', status: 'active', lastLoginAt: recent });
			expect(staff.find((s) => s.id === blocked.id)?.lastLoginAt).toBeNull();
		});
	});

	it('finds active members by name or email for a new role', async () => {
		await inRollback(async (tx) => {
			const member = await insertUser(tx);
			const editor = await insertUser(tx, { role: 'editor', lastName: member.tag });
			const blocked = await insertUser(tx, { status: 'blocked', lastName: member.tag });
			const byName = await findMembers(tx, member.tag);
			expect(byName.map((m) => m.id)).toEqual([member.id]);
			expect(byName.map((m) => m.id)).not.toContain(editor.id);
			expect(byName.map((m) => m.id)).not.toContain(blocked.id);
			const byEmail = await findMembers(tx, member.email);
			expect(byEmail.map((m) => m.id)).toEqual([member.id]);
			expect(await findMembers(tx, '   ')).toEqual([]);
		});
	});
});
