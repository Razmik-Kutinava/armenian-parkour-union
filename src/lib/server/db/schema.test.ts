import { existsSync } from 'node:fs';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.DATABASE_URL;

class Rollback extends Error {}

/* Every test runs in a transaction that is rolled back: no rows stay behind, even in audit_log. */
describe.skipIf(!url)('database schema (migration 0001)', () => {
	const sql = postgres(url ?? '', { max: 1, onnotice: () => {} });
	afterAll(() => sql.end());

	async function inRollback(fn: (tx: postgres.TransactionSql) => Promise<void>) {
		await sql
			.begin(async (tx) => {
				await fn(tx);
				throw new Rollback();
			})
			.catch((e) => {
				if (!(e instanceof Rollback)) throw e;
			});
	}

	async function expectError(tx: postgres.TransactionSql, query: () => Promise<unknown>) {
		const error = await tx.savepoint(() => query()).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(Error);
		return error as postgres.PostgresError;
	}

	const newUser = (tx: postgres.TransactionSql, email = `t-${crypto.randomUUID()}@example.com`) =>
		tx`insert into users (email, name) values (${email}, 'Test') returning *`.then((r) => r[0]);

	it('new user gets member role, active status, ru locale, zero balance', async () => {
		await inRollback(async (tx) => {
			const user = await newUser(tx);
			expect(user.role).toBe('member');
			expect(user.status).toBe('active');
			expect(user.locale).toBe('ru');
			expect(user.points_balance).toBe(0);
			expect(user.email_verified).toBe(false);
		});
	});

	it('email is unique and must be lower case', async () => {
		await inRollback(async (tx) => {
			await newUser(tx, 'same@example.com');
			expect((await expectError(tx, () => newUser(tx, 'same@example.com'))).code).toBe('23505');
			expect((await expectError(tx, () => newUser(tx, 'Upper@Example.com'))).code).toBe('23514');
		});
	});

	it('points balance cannot go negative', async () => {
		await inRollback(async (tx) => {
			const user = await newUser(tx);
			const error = await expectError(
				tx,
				() => tx`update users set points_balance = -1 where id = ${user.id}`
			);
			expect(error.code).toBe('23514');
		});
	});

	it('audit_log accepts inserts but rejects update, delete and truncate', async () => {
		await inRollback(async (tx) => {
			const [row] = await tx`insert into audit_log (action) values ('test.insert') returning id`;
			expect(row.id).toBeTruthy();
			for (const query of [
				() => tx`update audit_log set action = 'changed' where id = ${row.id}`,
				() => tx`delete from audit_log where id = ${row.id}`,
				() => tx`truncate audit_log`
			]) {
				const error = await expectError(tx, query);
				expect(error.code).toBe('23001');
				expect(error.message).toContain('append-only');
			}
		});
	});

	it('deleting a user removes their sessions', async () => {
		await inRollback(async (tx) => {
			const user = await newUser(tx);
			await tx`insert into session (token, expires_at, user_id) values (${crypto.randomUUID()}, now() + interval '1 day', ${user.id})`;
			await tx`delete from users where id = ${user.id}`;
			const [{ count }] =
				await tx`select count(*)::int as count from session where user_id = ${user.id}`;
			expect(count).toBe(0);
		});
	});
});
