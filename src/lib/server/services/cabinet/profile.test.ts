import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { OwnProfileInput } from '#lib/validation/cabinet.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { users } from '../../db/schema/users';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { getOwnProfile, updateOwnProfile } from './profile';

/* docs/06 section 5.2: the member edits their own profile; birth date only through an admin;
 * parent data is kept only under 18 by the stored birth date (docs/03 section 13). */

const TODAY = new Date('2026-10-20T08:00:00Z');

const input = (extra: Partial<OwnProfileInput> = {}): OwnProfileInput => ({
	firstName: 'Narek',
	lastName: 'Sargsyan',
	phone: '+374 91 123456',
	country: 'AM',
	city: 'Gyumri',
	bio: 'Traceur since 2015.',
	locale: 'ru',
	...extra
});

const row = async (tx: LimitDb, id: string) =>
	(await tx.select().from(users).where(eq(users.id, id)))[0];

describe.skipIf(!testDbUrl)('cabinet: own profile', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('reads own fields, minor flag and whether a password is set', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, { birthDate: '2012-05-01', city: 'Yerevan' });
			const profile = await getOwnProfile(tx, user.id, TODAY);
			expect(profile).toMatchObject({
				email: user.email,
				birthDate: '2012-05-01',
				city: 'Yerevan',
				minor: true,
				hasPassword: false
			});
		});
	});

	it('saves the fields and the display name; birth date stays as it was', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, { birthDate: '1990-01-01' });
			expect(await updateOwnProfile(tx, user.id, input(), TODAY)).toBe('ok');
			const saved = await row(tx, user.id);
			expect(saved).toMatchObject({
				name: 'Narek Sargsyan',
				firstName: 'Narek',
				lastName: 'Sargsyan',
				phone: '+374 91 123456',
				country: 'AM',
				city: 'Gyumri',
				bio: 'Traceur since 2015.',
				locale: 'ru',
				birthDate: '1990-01-01'
			});
		});
	});

	it('blank optional fields become empty', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, { phone: '+37400000000', city: 'Vanadzor', bio: 'x' });
			const data = input({ phone: undefined, city: undefined, bio: undefined });
			expect(await updateOwnProfile(tx, user.id, data, TODAY)).toBe('ok');
			expect(await row(tx, user.id)).toMatchObject({ phone: null, city: null, bio: null });
		});
	});

	it('an adult: parent data is dropped even if sent', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, { birthDate: '1990-01-01', guardianName: 'Old' });
			const data = input({
				guardianName: 'Mom',
				guardianPhone: '+37491000000',
				guardianEmail: 'mom@example.com'
			});
			expect(await updateOwnProfile(tx, user.id, data, TODAY)).toBe('ok');
			expect(await row(tx, user.id)).toMatchObject({
				guardianName: null,
				guardianPhone: null,
				guardianEmail: null
			});
		});
	});

	it('a minor by the stored birth date: parent data is required and saved', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, { birthDate: '2012-05-01' });
			expect(await updateOwnProfile(tx, user.id, input(), TODAY)).toBe('guardian_required');
			const data = input({
				guardianName: 'Mom',
				guardianPhone: '+37491000000',
				guardianEmail: 'mom@example.com'
			});
			expect(await updateOwnProfile(tx, user.id, data, TODAY)).toBe('ok');
			expect(await row(tx, user.id)).toMatchObject({
				guardianName: 'Mom',
				guardianPhone: '+37491000000',
				guardianEmail: 'mom@example.com'
			});
		});
	});

	it('another user is not touched; deleted, unknown or malformed id — not found', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx);
			const other = await insertUser(tx, { city: 'Dilijan' });
			await updateOwnProfile(tx, user.id, input(), TODAY);
			expect((await row(tx, other.id)).city).toBe('Dilijan');
			const gone = await insertUser(tx, { deletedAt: new Date() });
			expect(await updateOwnProfile(tx, gone.id, input(), TODAY)).toBe('not_found');
			expect(await getOwnProfile(tx, gone.id, TODAY)).toBeNull();
			expect(await updateOwnProfile(tx, crypto.randomUUID(), input(), TODAY)).toBe('not_found');
			expect(await updateOwnProfile(tx, 'nope', input(), TODAY)).toBe('not_found');
		});
	});
});
