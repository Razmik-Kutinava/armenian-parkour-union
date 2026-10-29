import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { users } from '../../db/schema/users';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { updateOwnPrivacy } from './privacy';
import { getOwnProfile, updateOwnProfile } from './profile';

/* docs/06 section 5.2 "Privacy", decisions.md 2026-10-22: city and photo are hidden by default. */

const row = async (tx: LimitDb, id: string) =>
	(await tx.select().from(users).where(eq(users.id, id)))[0];

describe.skipIf(!testDbUrl)('cabinet: privacy', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('both are off for a new account; the member switches them', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx);
			expect(await getOwnProfile(tx, user.id)).toMatchObject({
				showCity: false,
				showAvatar: false
			});
			const on = { showCity: true, showAvatar: true };
			expect(await updateOwnPrivacy(tx, user.id, on)).toBe('ok');
			expect(await row(tx, user.id)).toMatchObject(on);
			expect(await updateOwnPrivacy(tx, user.id, { showCity: false, showAvatar: true })).toBe('ok');
			expect(await row(tx, user.id)).toMatchObject({ showCity: false, showAvatar: true });
		});
	});

	it('saving the profile keeps the privacy choice', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx);
			await updateOwnPrivacy(tx, user.id, { showCity: true, showAvatar: true });
			const data = { firstName: 'A', lastName: 'B', country: 'AM', locale: 'en' as const };
			expect(await updateOwnProfile(tx, user.id, data)).toBe('ok');
			expect(await row(tx, user.id)).toMatchObject({ showCity: true, showAvatar: true });
		});
	});

	it('another user is not touched; deleted, unknown or malformed id — not found', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx);
			const other = await insertUser(tx);
			await updateOwnPrivacy(tx, user.id, { showCity: true, showAvatar: true });
			expect(await row(tx, other.id)).toMatchObject({ showCity: false, showAvatar: false });
			const gone = await insertUser(tx, { deletedAt: new Date() });
			const on = { showCity: true, showAvatar: true };
			expect(await updateOwnPrivacy(tx, gone.id, on)).toBe('not_found');
			expect(await updateOwnPrivacy(tx, crypto.randomUUID(), on)).toBe('not_found');
			expect(await updateOwnPrivacy(tx, 'nope', on)).toBe('not_found');
		});
	});
});
