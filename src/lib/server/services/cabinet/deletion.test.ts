import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { auditLog } from '../../db/schema/service';
import { users } from '../../db/schema/users';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { cancelOwnDeletion, requestOwnDeletion } from './deletion';
import { getOwnProfile } from './profile';

/* docs/06 section 5.2: the member asks to delete the account, an admin handles it
 * (decisions.md 2026-10-22). Until then the member can take the request back. */

const NOW = new Date('2026-10-29T08:00:00Z');
const IP = '198.51.100.7';

const row = async (tx: LimitDb, id: string) =>
	(await tx.select().from(users).where(eq(users.id, id)))[0];
const auditOf = (tx: LimitDb, id: string, action: string) =>
	tx
		.select()
		.from(auditLog)
		.where(and(eq(auditLog.entityId, id), eq(auditLog.action, action)));

describe.skipIf(!testDbUrl)('cabinet: account deletion request', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('the request is stored once with its date and logged by the member', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx);
			expect((await getOwnProfile(tx, user.id))?.deletionRequestedAt).toBeNull();
			expect(await requestOwnDeletion(tx, user.id, IP, NOW)).toBe('ok');
			expect(await requestOwnDeletion(tx, user.id, IP, new Date('2026-10-30T08:00:00Z'))).toBe(
				'ok'
			);
			const saved = await row(tx, user.id);
			expect(saved.deletionRequestedAt).toEqual(NOW);
			expect(saved.deletedAt).toBeNull();
			expect((await getOwnProfile(tx, user.id))?.deletionRequestedAt).toEqual(NOW);
			const entries = await auditOf(tx, user.id, 'user.deletion_request');
			expect(entries).toHaveLength(1);
			expect(entries[0]).toMatchObject({ actorId: user.id, entityType: 'user', ip: IP });
		});
	});

	it('the member takes the request back; a second cancel changes nothing', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx);
			await requestOwnDeletion(tx, user.id, IP, NOW);
			expect(await cancelOwnDeletion(tx, user.id, IP)).toBe('ok');
			expect(await cancelOwnDeletion(tx, user.id, IP)).toBe('ok');
			expect((await row(tx, user.id)).deletionRequestedAt).toBeNull();
			expect(await auditOf(tx, user.id, 'user.deletion_cancel')).toHaveLength(1);
		});
	});

	it('another user is not touched; deleted, unknown or malformed id — not found', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx);
			const other = await insertUser(tx);
			await requestOwnDeletion(tx, user.id, IP, NOW);
			expect((await row(tx, other.id)).deletionRequestedAt).toBeNull();
			const gone = await insertUser(tx, { deletedAt: NOW });
			expect(await requestOwnDeletion(tx, gone.id, IP, NOW)).toBe('not_found');
			expect(await cancelOwnDeletion(tx, gone.id, IP)).toBe('not_found');
			expect(await requestOwnDeletion(tx, crypto.randomUUID(), IP, NOW)).toBe('not_found');
			expect(await requestOwnDeletion(tx, 'nope', IP, NOW)).toBe('not_found');
		});
	});
});
