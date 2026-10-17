import { afterAll, describe, expect, it } from 'vitest';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { searchHeroPersons } from './persons';
import { birthDateAgo, staff } from './test-support';

/* decisions.md 2026-10-08 (2.6): only adults by birth date; the editor sees name and avatar. */

describe.skipIf(!testDbUrl)('hero: choosing a person', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('finds active adults by name; minors, no birth date, blocked and deleted are not offered', async () => {
		await inRollback(async (tx) => {
			const editor = await staff(tx);
			const tag = crypto.randomUUID().slice(0, 8);
			const lastName = `Hero${tag}`;
			const adult = await insertUser(tx, { lastName, birthDate: birthDateAgo(18, 2) });
			await insertUser(tx, { lastName, birthDate: birthDateAgo(18, -2) });
			await insertUser(tx, { lastName, birthDate: null });
			await insertUser(tx, { lastName, birthDate: birthDateAgo(30), status: 'blocked' });
			await insertUser(tx, { lastName, birthDate: birthDateAgo(30), deletedAt: new Date() });
			const found = await searchHeroPersons(tx, editor, lastName.toLowerCase());
			expect(found).toEqual([{ id: adult.id, name: expect.any(String), avatarKey: null }]);
		});
	});

	it('the answer has no contacts or birth date; search by email finds nothing', async () => {
		await inRollback(async (tx) => {
			const editor = await staff(tx);
			const adult = await insertUser(tx, { birthDate: birthDateAgo(30) });
			const found = await searchHeroPersons(tx, editor, adult.lastName!);
			expect(found).toHaveLength(1);
			expect(Object.keys(found === 'not_allowed' ? {} : found[0]).sort()).toEqual([
				'avatarKey',
				'id',
				'name'
			]);
			expect(await searchHeroPersons(tx, editor, adult.email)).toEqual([]);
		});
	});

	it('empty query finds nothing; moderator and member are not allowed', async () => {
		await inRollback(async (tx) => {
			expect(await searchHeroPersons(tx, await staff(tx, 'admin'), '   ')).toEqual([]);
			for (const role of ['moderator', 'member'] as const) {
				expect(await searchHeroPersons(tx, await staff(tx, role), 'a')).toBe('not_allowed');
			}
		});
	});
});
