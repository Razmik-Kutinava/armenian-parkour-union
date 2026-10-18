import { existsSync } from 'node:fs';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.DATABASE_URL;

class Rollback extends Error {}

/* docs/02 sections 2, 4; decisions 2026-10-18 (3.1). Every test is rolled back. */
describe.skipIf(!url)('payments and memberships schema (migration 0007)', () => {
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
	const newPayment = (tx: postgres.TransactionSql, extra: Record<string, unknown> = {}) =>
		tx`insert into payments ${tx({ kind: 'donation', amount_minor: 1000, currency: 'AMD', provider: 'manual', ...extra })}
			returning *`.then((r) => r[0]);

	it('a payment starts pending, not flagged; an anonymous donation has no user', async () => {
		await inRollback(async (tx) => {
			const payment = await newPayment(tx, { donor_name: 'Anna', donor_email: 'a@example.com' });
			expect(payment).toMatchObject({
				user_id: null,
				status: 'pending',
				needs_review: false,
				is_anonymous: false
			});
			expect(payment.created_at).toBeInstanceOf(Date);
			expect(payment.updated_at).toBeInstanceOf(Date);
		});
	});

	it('amount must be positive', async () => {
		await inRollback(async (tx) => {
			expect((await expectError(tx, () => newPayment(tx, { amount_minor: 0 }))).code).toBe('23514');
			expect((await expectError(tx, () => newPayment(tx, { amount_minor: -5 }))).code).toBe(
				'23514'
			);
		});
	});

	it('provider payment id is unique per provider; many payments have none', async () => {
		await inRollback(async (tx) => {
			await newPayment(tx, { provider: 'mock', provider_payment_id: 'p-1' });
			await newPayment(tx, { provider: 'manual' });
			await newPayment(tx, { provider: 'manual' });
			await newPayment(tx, { provider: 'other', provider_payment_id: 'p-1' });
			const dup = await expectError(tx, () =>
				newPayment(tx, { provider: 'mock', provider_payment_id: 'p-1' })
			);
			expect(dup.code).toBe('23505');
		});
	});

	it('webhook event: unique per provider; only processed_at and error can change; never deleted', async () => {
		await inRollback(async (tx) => {
			const [event] = await tx`insert into payment_webhook_events (provider, event_id, payload)
				values ('mock', 'e-1', ${tx.json({ a: 1 })}) returning *`;
			const dup = await expectError(
				tx,
				() => tx`insert into payment_webhook_events (provider, event_id, payload)
					values ('mock', 'e-1', ${tx.json({ a: 2 })})`
			);
			expect(dup.code).toBe('23505');

			await tx`update payment_webhook_events set error = 'payment not found' where id = ${event.id}`;
			await tx`update payment_webhook_events set processed_at = now(), error = null where id = ${event.id}`;
			for (const change of [
				tx`update payment_webhook_events set payload = ${tx.json({ a: 3 })} where id = ${event.id}`,
				tx`update payment_webhook_events set event_id = 'e-2' where id = ${event.id}`,
				tx`update payment_webhook_events set provider = 'x' where id = ${event.id}`,
				tx`delete from payment_webhook_events where id = ${event.id}`
			]) {
				expect((await expectError(tx, () => change)).code).toBe('23001');
			}
		});
	});

	it('membership starts pending, ends after it starts, links to its payment both ways', async () => {
		await inRollback(async (tx) => {
			const user = await newUser(tx);
			const [membership] = await tx`insert into memberships (user_id) values (${user.id}) returning *`;
			expect(membership).toMatchObject({ status: 'pending', starts_at: null, ends_at: null });
			expect(membership.updated_at).toBeInstanceOf(Date);
			const payment = await newPayment(tx, {
				kind: 'membership',
				user_id: user.id,
				membership_id: membership.id
			});
			await tx`update memberships set payment_id = ${payment.id}, status = 'active',
				starts_at = now(), ends_at = now() + interval '1 year' where id = ${membership.id}`;
			const backwards = await expectError(
				tx,
				() => tx`update memberships set ends_at = starts_at - interval '1 day' where id = ${membership.id}`
			);
			expect(backwards.code).toBe('23514');
			const orphan = await expectError(
				tx,
				() => tx`insert into memberships (user_id) values (${crypto.randomUUID()})`
			);
			expect(orphan.code).toBe('23503');
		});
	});

	it('donation purpose: active, order 0, timestamps; a used purpose cannot be deleted', async () => {
		await inRollback(async (tx) => {
			const [purpose] = await tx`insert into donation_purposes (title)
				values (${tx.json({ en: 'Parkour park' })}) returning *`;
			expect(purpose).toMatchObject({ is_active: true, sort_order: 0 });
			expect(purpose.created_at).toBeInstanceOf(Date);
			expect(purpose.updated_at).toBeInstanceOf(Date);
			await newPayment(tx, { donation_purpose_id: purpose.id });
			const used = await expectError(
				tx,
				() => tx`delete from donation_purposes where id = ${purpose.id}`
			);
			expect(used.code).toBe('23503');
		});
	});
});
