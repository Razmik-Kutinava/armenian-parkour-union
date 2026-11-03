import { existsSync } from 'node:fs';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.DATABASE_URL;

class Rollback extends Error {}

/* Migration 0019: exam_applications (docs/todo.md debt stage 6). */
describe.skipIf(!url)('exam_applications schema (migration 0019)', () => {
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

	async function expectCode(
		tx: postgres.TransactionSql,
		code: string,
		query: () => Promise<unknown>
	) {
		const error = await tx.savepoint(() => query()).catch((e: unknown) => e);
		expect((error as postgres.PostgresError).code).toBe(code);
	}

	const newUser = (tx: postgres.TransactionSql) =>
		tx`insert into users (email, name) values (${`t-${crypto.randomUUID()}@example.com`}, 'Test')
			returning *`.then((r) => r[0]);

	it('starts pending; one row per user and kind; rejected needs a note', async () => {
		await inRollback(async (tx) => {
			const user = await newUser(tx);
			const [row] = await tx`insert into exam_applications (user_id, kind)
				values (${user.id}, 'level_advanced') returning *`;
			expect(row).toMatchObject({
				status: 'pending',
				exam_id: null,
				review_note: null
			});
			for (const key of ['created_at', 'updated_at']) expect(row[key]).toBeInstanceOf(Date);
			await expectCode(
				tx,
				'23505',
				() =>
					tx`insert into exam_applications (user_id, kind) values (${user.id}, 'level_advanced')`
			);
			await expectCode(
				tx,
				'23514',
				() =>
					tx`update exam_applications set status = 'rejected', review_note = '' where id = ${row.id}`
			);
			await tx`update exam_applications set status = 'rejected', review_note = 'Not ready'
				where id = ${row.id}`;
			await tx`insert into exam_applications (user_id, kind) values (${user.id}, 'level_pro')`;
		});
	});
});
