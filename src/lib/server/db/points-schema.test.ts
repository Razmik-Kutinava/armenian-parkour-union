import { existsSync } from 'node:fs';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.DATABASE_URL;

class Rollback extends Error {}

/* docs/02 section 5; decisions 2026-10-20 (4.1). Every test is rolled back. */
describe.skipIf(!url)('points schema (migration 0009)', () => {
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

	const newUser = (tx: postgres.TransactionSql) =>
		tx`insert into users (email, name) values (${`t-${crypto.randomUUID()}@example.com`}, 'Test')
			returning *`.then((r) => r[0]);
	const addEntry = (tx: postgres.TransactionSql, values: Record<string, unknown>) =>
		tx`insert into points_ledger ${tx({ delta: 10, reason: 'manual', comment: 'test', ...values })}
			returning *`.then((r) => r[0]);

	it('a rule is active by default, the code is unique, timestamps are set', async () => {
		await inRollback(async (tx) => {
			const code = `test_${crypto.randomUUID()}`;
			const [rule] = await tx`insert into points_rules (code, title, points)
				values (${code}, ${tx.json({ en: 'Test' })}, 5) returning *`;
			expect(rule).toMatchObject({ is_active: true, points: 5, updated_by: null });
			expect(rule.created_at).toBeInstanceOf(Date);
			expect(rule.updated_at).toBeInstanceOf(Date);
			const dup = await expectError(
				tx,
				() => tx`insert into points_rules (code, title, points)
					values (${code}, ${tx.json({ en: 'Again' })}, 1)`
			);
			expect(dup.code).toBe('23505');
		});
	});

	it('ledger accepts inserts but rejects update, delete and truncate', async () => {
		await inRollback(async (tx) => {
			const user = await newUser(tx);
			const entry = await addEntry(tx, { user_id: user.id });
			for (const query of [
				() => tx`update points_ledger set delta = 99 where id = ${entry.id}`,
				() => tx`delete from points_ledger where id = ${entry.id}`,
				() => tx`truncate points_ledger`
			]) {
				const error = await expectError(tx, query);
				expect(error.code).toBe('23001');
				expect(error.message).toContain('append-only');
			}
		});
	});

	it('the same source cannot be rewarded twice; manual entries can repeat', async () => {
		await inRollback(async (tx) => {
			const user = await newUser(tx);
			const source = { user_id: user.id, reason: 'video', source_type: 'video' };
			const sourceId = crypto.randomUUID();
			await addEntry(tx, { ...source, source_id: sourceId, comment: null });
			const dup = await expectError(tx, () =>
				addEntry(tx, { ...source, source_id: sourceId, comment: null })
			);
			expect(dup.code).toBe('23505');
			await addEntry(tx, { ...source, source_id: crypto.randomUUID(), comment: null });
			await addEntry(tx, { user_id: user.id, source_type: 'video', source_id: sourceId });
			await addEntry(tx, { user_id: user.id, source_type: 'video', source_id: sourceId });
		});
	});

	it('an entry can be reversed only once; a reversal must point to an entry', async () => {
		await inRollback(async (tx) => {
			const user = await newUser(tx);
			const entry = await addEntry(tx, { user_id: user.id });
			const reversal = { user_id: user.id, delta: -10, reason: 'reversal', comment: 'mistake' };
			await addEntry(tx, { ...reversal, reversal_of_id: entry.id });
			const twice = await expectError(tx, () =>
				addEntry(tx, { ...reversal, reversal_of_id: entry.id })
			);
			expect(twice.code).toBe('23505');
			const unlinked = await expectError(tx, () => addEntry(tx, reversal));
			expect(unlinked.code).toBe('23514');
			const missing = await expectError(tx, () =>
				addEntry(tx, { ...reversal, reversal_of_id: crypto.randomUUID() })
			);
			expect(missing.code).toBe('23503');
			const linkedManual = await expectError(tx, () =>
				addEntry(tx, { user_id: user.id, reversal_of_id: entry.id })
			);
			expect(linkedManual.code).toBe('23514');
		});
	});

	it('delta is never zero; manual and reversal entries need a comment', async () => {
		await inRollback(async (tx) => {
			const user = await newUser(tx);
			const entry = await addEntry(tx, { user_id: user.id });
			for (const values of [
				{ delta: 0 },
				{ comment: null },
				{ comment: '   ' },
				{ reason: 'reversal', delta: -10, comment: '', reversal_of_id: entry.id }
			]) {
				const error = await expectError(tx, () => addEntry(tx, { user_id: user.id, ...values }));
				expect(error.code).toBe('23514');
			}
			const system = await addEntry(tx, {
				user_id: user.id,
				reason: 'certificate',
				source_type: 'certificate',
				source_id: crypto.randomUUID(),
				comment: null
			});
			expect(system).toMatchObject({ created_by: null, rule_id: null });
		});
	});

	it('a user with ledger entries cannot be hard-deleted', async () => {
		await inRollback(async (tx) => {
			const user = await newUser(tx);
			await addEntry(tx, { user_id: user.id });
			const error = await expectError(tx, () => tx`delete from users where id = ${user.id}`);
			expect(error.code).toBe('23503');
		});
	});
});
