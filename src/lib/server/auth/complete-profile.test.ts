import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { users } from '../db/schema/users';
import { insertUser, testDb, testDbUrl } from '../db/test-db';
import type { LimitDb } from './rate-limit';
import { completeProfile } from './complete-profile';

const today = new Date('2026-10-18T12:00:00Z');
const guardian = {
	guardianName: 'Parent Name',
	guardianPhone: '+374 91 123456',
	guardianEmail: 'parent@example.com'
};

const read = async (tx: LimitDb, id: string) => {
	const [row] = await tx.select().from(users).where(eq(users.id, id));
	return row;
};

describe.skipIf(!testDbUrl)('completeProfile', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('saves names, birth date, consent and language; adult keeps no parent data', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, { birthDate: null, termsAcceptedAt: null });
			const done = await completeProfile(
				tx,
				user.id,
				{
					firstName: 'Ani',
					lastName: 'Petrosyan',
					birthDate: '1995-04-20',
					terms: true,
					...guardian
				},
				'hy',
				today
			);
			expect(done).toBe(true);
			const row = await read(tx, user.id);
			expect(row).toMatchObject({
				firstName: 'Ani',
				lastName: 'Petrosyan',
				name: 'Ani Petrosyan',
				birthDate: '1995-04-20',
				locale: 'hy',
				guardianName: null,
				guardianPhone: null,
				guardianEmail: null
			});
			expect(row.termsAcceptedAt).toBeInstanceOf(Date);
		});
	});

	it('minor: parent data is stored', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, { birthDate: null, termsAcceptedAt: null });
			const data = { firstName: 'A', lastName: 'B', birthDate: '2012-06-01', terms: true as const };
			await completeProfile(tx, user.id, { ...data, ...guardian }, 'en', today);
			expect(await read(tx, user.id)).toMatchObject(guardian);
		});
	});

	it('a completed profile is not overwritten by a second submit', async () => {
		await inRollback(async (tx) => {
			const accepted = new Date('2026-01-01T00:00:00Z');
			const user = await insertUser(tx, { termsAcceptedAt: accepted });
			const data = { firstName: 'X', lastName: 'Y', birthDate: '2000-01-01', terms: true as const };
			expect(await completeProfile(tx, user.id, data, 'en', today)).toBe(false);
			const row = await read(tx, user.id);
			expect(row.firstName).toBe('Test');
			expect(row.termsAcceptedAt).toEqual(accepted);
		});
	});
});
