import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { session } from '../../db/schema/auth';
import { auditLog } from '../../db/schema/service';
import { users } from '../../db/schema/users';
import { insertUser, onlyAdmin, testDb, testDbUrl } from '../../db/test-db';
import { declineDeletion, deleteAccount } from './deletion';

/* decisions.md 2026-10-22: only an admin, only on the member's request; deletion is soft
 * (docs/03 section 1 p. 6) and ends every session; the last active admin stays (docs/04 6.3). */

const IP = '198.51.100.2';
const ASKED = new Date('2026-10-28T10:00:00Z');
const NOW = new Date('2026-10-29T08:00:00Z');

describe.skipIf(!testDbUrl)('account deletion by an admin', () => {
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

	it('deletes softly: the row stays with its points, sessions end, the audit log has it', async () => {
		await inRollback(async (tx) => {
			const actor = await admin(tx);
			const target = await insertUser(tx, { deletionRequestedAt: ASKED, pointsBalance: 40 });
			const expiresAt = new Date(Date.now() + 3_600_000);
			await tx.insert(session).values([
				{ userId: target.id, token: crypto.randomUUID(), expiresAt },
				{ userId: target.id, token: crypto.randomUUID(), expiresAt }
			]);
			expect(await deleteAccount(tx, actor, target.id, IP, NOW)).toBe('ok');
			expect(await userRow(tx, target.id)).toMatchObject({ deletedAt: NOW, pointsBalance: 40 });
			expect(await tx.select().from(session).where(eq(session.userId, target.id))).toHaveLength(0);
			const [entry] = await auditOf(tx, target.id, 'user.delete');
			expect(entry).toMatchObject({ actorId: actor.id, entityType: 'user', ip: IP });
			expect(entry.before).toEqual({ deletionRequestedAt: ASKED.toISOString() });
			expect(await deleteAccount(tx, actor, target.id, IP, NOW)).toBe('not_found');
		});
	});

	it('no request — nothing to delete; declining clears the request and is logged', async () => {
		await inRollback(async (tx) => {
			const actor = await admin(tx);
			const quiet = await insertUser(tx);
			expect(await deleteAccount(tx, actor, quiet.id, IP, NOW)).toBe('not_requested');
			expect(await declineDeletion(tx, actor, quiet.id, IP)).toBe('not_requested');
			expect((await userRow(tx, quiet.id)).deletedAt).toBeNull();

			const asked = await insertUser(tx, { deletionRequestedAt: ASKED });
			expect(await declineDeletion(tx, actor, asked.id, IP)).toBe('ok');
			expect(await userRow(tx, asked.id)).toMatchObject({
				deletionRequestedAt: null,
				deletedAt: null
			});
			expect(await auditOf(tx, asked.id, 'user.deletion_reject')).toHaveLength(1);
		});
	});

	it('only an admin; not oneself; not the last active admin', async () => {
		await inRollback(async (tx) => {
			const actor = await admin(tx);
			const target = await insertUser(tx, { deletionRequestedAt: ASKED });
			for (const role of ['moderator', 'editor', 'member'] as const) {
				const other = { id: (await insertUser(tx, { role })).id, role };
				expect(await deleteAccount(tx, other, target.id, IP, NOW)).toBe('not_admin');
				expect(await declineDeletion(tx, other, target.id, IP)).toBe('not_admin');
			}
			await tx.update(users).set({ deletionRequestedAt: ASKED }).where(eq(users.id, actor.id));
			expect(await deleteAccount(tx, actor, actor.id, IP, NOW)).toBe('self');

			const last = await insertUser(tx, { role: 'admin', deletionRequestedAt: ASKED });
			await onlyAdmin(tx, last.id);
			expect(await deleteAccount(tx, actor, last.id, IP, NOW)).toBe('last_admin');
			expect(await userRow(tx, last.id)).toMatchObject({ deletedAt: null });
			expect((await userRow(tx, target.id)).deletedAt).toBeNull();
		});
	});

	it('unknown, malformed or already deleted → not_found', async () => {
		await inRollback(async (tx) => {
			const actor = await admin(tx);
			const gone = await insertUser(tx, { deletionRequestedAt: ASKED, deletedAt: ASKED });
			expect(await deleteAccount(tx, actor, gone.id, IP, NOW)).toBe('not_found');
			expect(await declineDeletion(tx, actor, gone.id, IP)).toBe('not_found');
			expect(await deleteAccount(tx, actor, crypto.randomUUID(), IP, NOW)).toBe('not_found');
			expect(await deleteAccount(tx, actor, 'nope', IP, NOW)).toBe('not_found');
		});
	});
});
