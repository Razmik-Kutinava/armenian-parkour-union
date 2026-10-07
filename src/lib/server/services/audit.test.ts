import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { auditLog } from '../db/schema/service';
import { insertUser, testDb, testDbUrl } from '../db/test-db';
import { userHistory, writeAudit } from './audit';

describe.skipIf(!testDbUrl)('audit', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('writes who, what, before, after and IP', async () => {
		await inRollback(async (tx) => {
			const actor = await insertUser(tx);
			const target = await insertUser(tx);
			await writeAudit(tx, {
				actorId: actor.id,
				action: 'user.role_change',
				entityType: 'user',
				entityId: target.id,
				before: { role: 'member' },
				after: { role: 'editor' },
				ip: '203.0.113.7'
			});
			const [row] = await tx.select().from(auditLog).where(eq(auditLog.entityId, target.id));
			expect(row).toMatchObject({
				actorId: actor.id,
				action: 'user.role_change',
				before: { role: 'member' },
				after: { role: 'editor' },
				ip: '203.0.113.7'
			});
		});
	});

	it('keeps a bad IP out instead of failing the action', async () => {
		await inRollback(async (tx) => {
			const target = await insertUser(tx);
			await writeAudit(tx, {
				actorId: null,
				action: 'user.update',
				entityType: 'user',
				entityId: target.id,
				ip: 'not-an-ip'
			});
			const [row] = await tx.select().from(auditLog).where(eq(auditLog.entityId, target.id));
			expect(row.ip).toBeNull();
		});
	});

	it('history of a user: newest first, with the actor name', async () => {
		await inRollback(async (tx) => {
			const actor = await insertUser(tx, { name: 'Admin Person' });
			const target = await insertUser(tx);
			const other = await insertUser(tx);
			const at = (action: string, entityId: string) =>
				writeAudit(tx, { actorId: actor.id, action, entityType: 'user', entityId });
			await at('user.update', target.id);
			await at('user.block', target.id);
			await at('user.update', other.id);
			const history = await userHistory(tx, target.id);
			expect(history.map((h) => h.action)).toEqual(['user.block', 'user.update']);
			expect(history[0].actorName).toBe('Admin Person');
		});
	});
});
