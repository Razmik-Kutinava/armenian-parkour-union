import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { session } from '../../db/schema/auth';
import { auditLog } from '../../db/schema/service';
import { users } from '../../db/schema/users';
import { insertUser, onlyAdmin, testDb, testDbUrl } from '../../db/test-db';
import { changeRole, confirmEmail, setBlocked } from './account';

const IP = '198.51.100.1';

describe.skipIf(!testDbUrl)('account actions (docs/04 section 6)', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	const admin = async (tx: LimitDb) => {
		const row = await insertUser(tx, { role: 'admin' });
		return { id: row.id, role: 'admin' as const };
	};
	const userRow = async (tx: LimitDb, id: string) =>
		(await tx.select().from(users).where(eq(users.id, id)))[0];
	const auditOf = (tx: LimitDb, id: string, action: string) =>
		tx
			.select()
			.from(auditLog)
			.where(and(eq(auditLog.entityId, id), eq(auditLog.action, action)));

	it('admin changes a role and the change is in the audit log', async () => {
		await inRollback(async (tx) => {
			const actor = await admin(tx);
			const target = await insertUser(tx);
			expect(await changeRole(tx, actor, target.id, 'editor', IP)).toBe('ok');
			expect((await userRow(tx, target.id)).role).toBe('editor');
			const [entry] = await auditOf(tx, target.id, 'user.role_change');
			expect(entry).toMatchObject({
				actorId: actor.id,
				entityType: 'user',
				before: { role: 'member' },
				after: { role: 'editor' },
				ip: IP
			});
		});
	});

	it('nobody changes their own role; non-admins change none', async () => {
		await inRollback(async (tx) => {
			const actor = await admin(tx);
			expect(await changeRole(tx, actor, actor.id, 'member', IP)).toBe('self');
			const mod = await insertUser(tx, { role: 'moderator' });
			const target = await insertUser(tx);
			const asMod = { id: mod.id, role: 'moderator' as const };
			expect(await changeRole(tx, asMod, target.id, 'editor', IP)).toBe('not_admin');
			expect((await userRow(tx, target.id)).role).toBe('member');
			expect(await auditOf(tx, target.id, 'user.role_change')).toHaveLength(0);
		});
	});

	it('the last active admin cannot be demoted or blocked', async () => {
		await inRollback(async (tx) => {
			const actor = await admin(tx);
			const last = await insertUser(tx, { role: 'admin' });
			await onlyAdmin(tx, last.id);
			// actor was demoted by onlyAdmin inside the transaction; act as an admin by id anyway
			expect(await changeRole(tx, actor, last.id, 'editor', IP)).toBe('last_admin');
			expect(await setBlocked(tx, actor, last.id, true, 'reason', IP)).toBe('last_admin');
			expect((await userRow(tx, last.id)).role).toBe('admin');
		});
	});

	it('a blocked or deleted admin is not a second one; taking the role is refused too', async () => {
		await inRollback(async (tx) => {
			const actor = await admin(tx);
			const last = await insertUser(tx, { role: 'admin' });
			await onlyAdmin(tx, last.id);
			await insertUser(tx, { role: 'admin', status: 'blocked' });
			await insertUser(tx, { role: 'admin', deletedAt: new Date() });
			expect(await changeRole(tx, actor, last.id, 'member', IP)).toBe('last_admin');
			expect(await setBlocked(tx, actor, last.id, true, 'reason', IP)).toBe('last_admin');
			expect(await userRow(tx, last.id)).toMatchObject({ role: 'admin', status: 'active' });
			expect(await auditOf(tx, last.id, 'user.role_change')).toHaveLength(0);
		});
	});

	it('a second admin can be demoted', async () => {
		await inRollback(async (tx) => {
			const actor = await admin(tx);
			const second = await insertUser(tx, { role: 'admin' });
			expect(await changeRole(tx, actor, second.id, 'member', IP)).toBe('ok');
		});
	});

	it('unknown or deleted user → not_found', async () => {
		await inRollback(async (tx) => {
			const actor = await admin(tx);
			const gone = await insertUser(tx, { deletedAt: new Date() });
			expect(await changeRole(tx, actor, crypto.randomUUID(), 'editor', IP)).toBe('not_found');
			expect(await changeRole(tx, actor, 'not-a-uuid', 'editor', IP)).toBe('not_found');
			expect(await setBlocked(tx, actor, gone.id, true, 'r', IP)).toBe('not_found');
		});
	});

	it('blocking ends every session and logs the reason; unblocking logs too', async () => {
		await inRollback(async (tx) => {
			const actor = await admin(tx);
			const target = await insertUser(tx);
			const expiresAt = new Date(Date.now() + 3_600_000);
			await tx.insert(session).values([
				{ userId: target.id, token: crypto.randomUUID(), expiresAt },
				{ userId: target.id, token: crypto.randomUUID(), expiresAt }
			]);
			expect(await setBlocked(tx, actor, target.id, true, 'Spam', IP)).toBe('ok');
			expect((await userRow(tx, target.id)).status).toBe('blocked');
			expect(await tx.select().from(session).where(eq(session.userId, target.id))).toHaveLength(0);
			const [blocked] = await auditOf(tx, target.id, 'user.block');
			expect(blocked.after).toEqual({ status: 'blocked', reason: 'Spam' });

			expect(await setBlocked(tx, actor, target.id, false, null, IP)).toBe('ok');
			expect((await userRow(tx, target.id)).status).toBe('active');
			expect(await auditOf(tx, target.id, 'user.unblock')).toHaveLength(1);
		});
	});

	it('an admin cannot block themselves', async () => {
		await inRollback(async (tx) => {
			const actor = await admin(tx);
			expect(await setBlocked(tx, actor, actor.id, true, 'r', IP)).toBe('self');
		});
	});

	it('manual email confirmation is logged once', async () => {
		await inRollback(async (tx) => {
			const actor = await admin(tx);
			const target = await insertUser(tx);
			expect(await confirmEmail(tx, actor, target.id, IP)).toBe('ok');
			expect((await userRow(tx, target.id)).emailVerified).toBe(true);
			expect(await confirmEmail(tx, actor, target.id, IP)).toBe('ok');
			expect(await auditOf(tx, target.id, 'user.email_confirm')).toHaveLength(1);
		});
	});
});
