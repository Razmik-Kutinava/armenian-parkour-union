import { existsSync } from 'node:fs';
import { and, eq, ne } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { LimitDb } from '../auth/rate-limit';
import type { UserRole } from '../auth/session';
import { users } from './schema/users';

/* Test support only: database tests run in a transaction that is always rolled back. */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
export const testDbUrl = process.env.DATABASE_URL;

class Rollback extends Error {}

export function testDb() {
	const client = postgres(testDbUrl ?? '', { max: 1, onnotice: () => {} });
	const db = drizzle(client);
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
	return { inRollback, close: () => client.end() };
}

type NewTestUser = Partial<typeof users.$inferInsert> & { role?: UserRole };

/** A user with a unique email; the tag goes into the last name so searches can find only it. */
export async function insertUser(tx: LimitDb, values: NewTestUser = {}) {
	const tag = crypto.randomUUID();
	const [row] = await tx
		.insert(users)
		.values({
			email: `t-${tag}@example.com`,
			name: `Test ${tag}`,
			firstName: 'Test',
			lastName: tag,
			birthDate: '1990-01-01',
			locale: 'en',
			...values
		})
		.returning({ id: users.id, email: users.email, lastName: users.lastName });
	return { ...row, tag };
}

/** Leaves `keep` as the only active admin inside the rolled-back transaction. */
export async function onlyAdmin(tx: LimitDb, keepId: string) {
	await tx
		.update(users)
		.set({ role: 'member' })
		.where(and(eq(users.role, 'admin'), ne(users.id, keepId)));
}
