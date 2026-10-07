import { afterAll, describe, expect, it } from 'vitest';
import { account } from '../db/schema/auth';
import { insertUser, testDb, testDbUrl } from '../db/test-db';
import { hasPassword } from './credential';

describe.skipIf(!testDbUrl)('hasPassword', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('true only with a credential account (set-password mail otherwise)', async () => {
		await inRollback(async (tx) => {
			const created = await insertUser(tx);
			const withPassword = await insertUser(tx);
			await tx.insert(account).values({
				userId: withPassword.id,
				accountId: withPassword.id,
				providerId: 'credential',
				password: 'hash'
			});
			expect(await hasPassword(tx, created.id)).toBe(false);
			expect(await hasPassword(tx, withPassword.id)).toBe(true);
		});
	});
});
