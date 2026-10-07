import { existsSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../auth/rate-limit';
import { users } from '../db/schema/users';
import { setLocale } from './profile';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.DATABASE_URL;

class Rollback extends Error {}

describe.skipIf(!url)('setLocale', () => {
	const client = postgres(url ?? '', { max: 1, onnotice: () => {} });
	const db = drizzle(client);
	afterAll(() => client.end());

	async function inRollback(fn: (tx: LimitDb) => Promise<void>) {
		await db
			.transaction(async (tx) => {
				await fn(tx);
				throw new Rollback();
			})
			.catch((e) => {
				if (!(e instanceof Rollback)) throw e;
			});
	}

	const insertUser = async (tx: LimitDb, email: string) => {
		const [row] = await tx
			.insert(users)
			.values({
				email,
				name: 'T',
				firstName: 'T',
				lastName: 'T',
				birthDate: '1990-01-01',
				locale: 'en'
			})
			.returning({ id: users.id });
		return row.id;
	};

	it('changes only the given user', async () => {
		await inRollback(async (tx) => {
			const a = await insertUser(tx, `t-${crypto.randomUUID()}@example.com`);
			const b = await insertUser(tx, `t-${crypto.randomUUID()}@example.com`);
			await setLocale(tx, a, 'ru');
			const rows = await tx
				.select({ id: users.id, locale: users.locale })
				.from(users)
				.where(eq(users.id, a));
			expect(rows[0].locale).toBe('ru');
			const other = await tx.select({ locale: users.locale }).from(users).where(eq(users.id, b));
			expect(other[0].locale).toBe('en');
		});
	});
});
