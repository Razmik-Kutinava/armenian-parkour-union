import { existsSync } from 'node:fs';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.DATABASE_URL;

class Rollback extends Error {}

/* docs/02 sections 3, 9; decisions 2026-10-22 (5.1). Every test is rolled back. */
describe.skipIf(!url)('registrations and consents schema (migration 0011)', () => {
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
	const newEvent = (tx: postgres.TransactionSql) =>
		tx`insert into events (slug, title, starts_at, ends_at)
			values (${`t-${crypto.randomUUID()}`}, ${tx.json({ en: 'Test' })}, now(), now() + interval '1 hour')
			returning *`.then((r) => r[0]);
	const register = (tx: postgres.TransactionSql, values: Record<string, unknown>) =>
		tx`insert into event_registrations ${tx(values)} returning *`.then((r) => r[0]);

	it('a registration starts registered with no hold; timestamps are set', async () => {
		await inRollback(async (tx) => {
			const [user, event] = [await newUser(tx), await newEvent(tx)];
			const row = await register(tx, { event_id: event.id, user_id: user.id });
			expect(row).toMatchObject({
				status: 'registered',
				category_id: null,
				payment_id: null,
				hold_until: null,
				attended_at: null,
				place: null,
				score: null
			});
			for (const key of ['registered_at', 'created_at', 'updated_at'])
				expect(row[key]).toBeInstanceOf(Date);
		});
	});

	it('one registration per user and event; another event is fine', async () => {
		await inRollback(async (tx) => {
			const [user, event, other] = [await newUser(tx), await newEvent(tx), await newEvent(tx)];
			await register(tx, { event_id: event.id, user_id: user.id });
			const dup = await expectError(tx, () =>
				register(tx, { event_id: event.id, user_id: user.id, status: 'waitlist' })
			);
			expect(dup.code).toBe('23505');
			await register(tx, { event_id: other.id, user_id: user.id });
		});
	});

	it('a registration can wait for payment until a hold time; score keeps two decimals', async () => {
		await inRollback(async (tx) => {
			const [user, event] = [await newUser(tx), await newEvent(tx)];
			const holdUntil = new Date(Date.now() + 30 * 60_000);
			const row = await register(tx, {
				event_id: event.id,
				user_id: user.id,
				status: 'pending_payment',
				hold_until: holdUntil,
				score: '9.75'
			});
			expect(row.status).toBe('pending_payment');
			expect(row.hold_until).toEqual(holdUntil);
			expect(Number(row.score)).toBe(9.75);
			const bad = await expectError(tx, async () =>
				register(tx, { event_id: event.id, user_id: (await newUser(tx)).id, status: 'paid' })
			);
			expect(bad.code).toBe('22P02');
		});
	});

	it('an event, category or user with registrations cannot be hard-deleted', async () => {
		await inRollback(async (tx) => {
			const [user, event] = [await newUser(tx), await newEvent(tx)];
			const [category] = await tx`insert into event_categories (event_id, name)
				values (${event.id}, ${tx.json({ en: 'Speed' })}) returning *`;
			await register(tx, { event_id: event.id, user_id: user.id, category_id: category.id });
			for (const query of [
				() => tx`delete from event_categories where id = ${category.id}`,
				() => tx`delete from events where id = ${event.id}`,
				() => tx`delete from users where id = ${user.id}`
			])
				expect((await expectError(tx, query)).code).toBe('23503');
		});
	});

	it('a consent starts pending; the reject reason and reviewer are stored', async () => {
		await inRollback(async (tx) => {
			const [user, admin] = [await newUser(tx), await newUser(tx)];
			const [row] = await tx`insert into consents (user_id, kind)
				values (${user.id}, 'parental') returning *`;
			expect(row).toMatchObject({ status: 'pending', review_note: null, reviewed_by: null });
			expect(row.created_at).toBeInstanceOf(Date);
			expect(row.updated_at).toBeInstanceOf(Date);
			const [rejected] = await tx`update consents
				set status = 'rejected', review_note = 'Unreadable scan', reviewed_by = ${admin.id}
				where id = ${row.id} returning *`;
			expect(rejected).toMatchObject({ status: 'rejected', review_note: 'Unreadable scan' });
			const badKind = await expectError(
				tx,
				() => tx`insert into consents (user_id, kind) values (${user.id}, 'photo')`
			);
			expect(badKind.code).toBe('22P02');
			const deleteUser = await expectError(tx, () => tx`delete from users where id = ${user.id}`);
			expect(deleteUser.code).toBe('23503');
		});
	});
});
