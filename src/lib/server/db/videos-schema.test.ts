import { existsSync } from 'node:fs';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.DATABASE_URL;

class Rollback extends Error {}

/* docs/02 section 6, docs/03 section 8; `hidden_at`, `updated_at` — decisions.md 2026-10-24 (7.1). */
describe.skipIf(!url)('videos schema (migration 0014)', () => {
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
	const add = (tx: postgres.TransactionSql, values: Record<string, unknown>) =>
		tx`insert into videos ${tx({
			url: `https://www.youtube.com/watch?v=${crypto.randomUUID().slice(0, 11)}`,
			platform: 'youtube',
			...values
		})} returning *`.then((r) => r[0]);

	it('a video starts pending, not reviewed, not hidden; a user with videos stays', async () => {
		await inRollback(async (tx) => {
			const user = await newUser(tx);
			const video = await add(tx, { user_id: user.id, title: 'Run' });
			expect(video).toMatchObject({
				status: 'pending',
				event_id: null,
				reviewed_by: null,
				reviewed_at: null,
				reject_reason: null,
				hidden_at: null
			});
			for (const key of ['created_at', 'updated_at']) expect(video[key]).toBeInstanceOf(Date);
			await expectCode(tx, '23503', () => tx`delete from users where id = ${user.id}`);
		});
	});

	it('one link once per user; another user may add the same link', async () => {
		await inRollback(async (tx) => {
			const [a, b] = [await newUser(tx), await newUser(tx)];
			const link = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
			await add(tx, { user_id: a.id, url: link });
			await expectCode(tx, '23505', () => add(tx, { user_id: a.id, url: link }));
			await add(tx, { user_id: b.id, url: link });
		});
	});

	it('platform only from the docs/02 list; url, platform and status are required', async () => {
		await inRollback(async (tx) => {
			const user = await newUser(tx);
			for (const platform of ['youtube', 'instagram', 'tiktok', 'other']) {
				await add(tx, { user_id: user.id, platform });
			}
			await expectCode(tx, '23514', () => add(tx, { user_id: user.id, platform: 'vimeo' }));
			await expectCode(tx, '23502', () => add(tx, { user_id: user.id, platform: null }));
			await expectCode(tx, '23502', () => add(tx, { user_id: user.id, url: null }));
			await expectCode(tx, '22P02', () => add(tx, { user_id: user.id, status: 'hidden' }));
		});
	});

	it('rejected needs a reason; a reason only when rejected; reviewed ones carry a time', async () => {
		await inRollback(async (tx) => {
			const user = await newUser(tx);
			const at = new Date();
			const rejected = { user_id: user.id, status: 'rejected', reviewed_at: at };
			await expectCode(tx, '23514', () => add(tx, rejected));
			await expectCode(tx, '23514', () => add(tx, { ...rejected, reject_reason: '  ' }));
			await add(tx, { ...rejected, reject_reason: 'Not parkour' });
			await expectCode(tx, '23514', () =>
				add(tx, { user_id: user.id, status: 'approved', reviewed_at: at, reject_reason: 'x' })
			);
			await expectCode(tx, '23514', () => add(tx, { user_id: user.id, status: 'approved' }));
			await expectCode(tx, '23514', () => add(tx, { user_id: user.id, reviewed_at: at }));
		});
	});

	it('only an approved video can be hidden', async () => {
		await inRollback(async (tx) => {
			const user = await newUser(tx);
			const at = new Date();
			await add(tx, { user_id: user.id, status: 'approved', reviewed_at: at, hidden_at: at });
			await expectCode(tx, '23514', () => add(tx, { user_id: user.id, hidden_at: at }));
		});
	});
});
