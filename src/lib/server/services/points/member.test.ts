import { afterAll, describe, expect, it } from 'vitest';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { adjustPoints } from './adjust';
import { findMember } from './member';
import { staffActor } from './test-support';

/* docs/05 section 12: the manual adjustment form finds the member by email and shows the balance. */

describe.skipIf(!testDbUrl)('admin points: member for the adjustment', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('by email in any case: id, name, email, balance', async () => {
		await inRollback(async (tx) => {
			const admin = await staffActor(tx);
			const member = await insertUser(tx);
			await adjustPoints(tx, admin, { userId: member.id, delta: 70, comment: 'x' }, { ip: null });
			expect(await findMember(tx, member.email.toUpperCase())).toEqual({
				id: member.id,
				name: `Test ${member.tag}`,
				email: member.email,
				balance: 70
			});
		});
	});

	it('unknown or deleted — none; a blocked member is found', async () => {
		await inRollback(async (tx) => {
			const deleted = await insertUser(tx, { deletedAt: new Date() });
			const blocked = await insertUser(tx, { status: 'blocked' });
			expect(await findMember(tx, deleted.email)).toBeNull();
			expect(await findMember(tx, `nobody-${crypto.randomUUID()}@example.com`)).toBeNull();
			expect((await findMember(tx, blocked.email))?.id).toBe(blocked.id);
		});
	});
});
