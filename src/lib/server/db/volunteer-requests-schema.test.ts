import { existsSync } from 'node:fs';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.DATABASE_URL;

class Rollback extends Error {}

/* docs/02 section 12 (requests, invitations, reports), section 5 (volunteer reasons). Rolled back. */
describe.skipIf(!url)('volunteer requests schema (migration 0018)', () => {
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

	async function expectCode(tx: postgres.TransactionSql, code: string, query: () => Promise<unknown>) {
		const error = await tx.savepoint(() => query()).catch((e: unknown) => e);
		expect((error as postgres.PostgresError).code).toBe(code);
	}

	const uid = () => crypto.randomUUID();
	const hours = (n: number) => new Date(Date.UTC(2026, 10, 10, n));
	const insert = (tx: postgres.TransactionSql, table: string, values: Record<string, unknown>) =>
		tx`insert into ${tx(table)} ${tx(values)} returning *`.then((r) => r[0]);
	const newUser = (tx: postgres.TransactionSql) =>
		insert(tx, 'users', { email: `t-${uid()}@example.com`, name: 'Test' });
	const request = (tx: postgres.TransactionSql, values = {}) =>
		insert(tx, 'volunteer_requests', {
			title: tx.json({ en: 'Jam help' }),
			starts_at: hours(10),
			ends_at: hours(14),
			respond_by: hours(8),
			places: 5,
			...values
		});
	const invite = (tx: postgres.TransactionSql, r: string, u: string, values = {}) =>
		insert(tx, 'volunteer_invitations', { request_id: r, user_id: u, ...values });
	const report = (tx: postgres.TransactionSql, i: string, u: string, values = {}) =>
		insert(tx, 'volunteer_reports', {
			invitation_id: i,
			user_id: u,
			url: 'https://www.instagram.com/p/abc',
			...values
		});

	it('requests: draft by default; times in order, at least one place', async () => {
		await inRollback(async (tx) => {
			const row = await request(tx, { respond_by: hours(10), ends_at: hours(10) });
			expect(row).toMatchObject({ status: 'draft', event_id: null, published_at: null });
			for (const key of ['created_at', 'updated_at']) expect(row[key]).toBeInstanceOf(Date);
			for (const values of [
				{ ends_at: hours(9) },
				{ places: 0 },
				{ respond_by: hours(11) }
			]) {
				await expectCode(tx, '23514', () => request(tx, values));
			}
			await expectCode(tx, '23502', () => request(tx, { places: null }));
			await expectCode(tx, '23502', () => request(tx, { respond_by: null }));
			await expectCode(tx, '23503', () => request(tx, { event_id: uid() }));
			await expectCode(tx, '22P02', () => request(tx, { status: 'closed' }));
		});
	});

	it('invitations: one per request and member, invited by default', async () => {
		await inRollback(async (tx) => {
			const [r, u] = [await request(tx), await newUser(tx)];
			const row = await invite(tx, r.id, u.id);
			expect(row).toMatchObject({ status: 'invited', answered_at: null, counted_at: null });
			await expectCode(tx, '23505', () => invite(tx, r.id, u.id));
			await expectCode(tx, '22P02', async () =>
				invite(tx, r.id, (await newUser(tx)).id, { status: 'maybe' })
			);
			await expectCode(tx, '23503', () => invite(tx, uid(), u.id));
		});
	});

	it('reports: a photo or a link, one live per invitation, rejected needs a note', async () => {
		await inRollback(async (tx) => {
			const [r, u, admin] = [await request(tx), await newUser(tx), await newUser(tx)];
			const i = await invite(tx, r.id, u.id, { status: 'attended' });
			const row = await report(tx, i.id, u.id);
			expect(row).toMatchObject({ status: 'pending', file_key: null, reviewed_at: null });
			await expectCode(tx, '23505', () => report(tx, i.id, u.id, { url: null, file_key: 'k' }));
			const refuse = { status: 'rejected', reviewed_by: admin.id, reviewed_at: new Date() };
			await expectCode(
				tx,
				'23514',
				() => tx`update volunteer_reports set ${tx(refuse)} where id = ${row.id}`
			);
			await tx`update volunteer_reports set ${tx({ ...refuse, review_note: 'Blurry' })}
				where id = ${row.id}`;
			const photo = { url: null, file_key: `volunteer/${u.id}/${uid()}.jpg` };
			const again = await report(tx, i.id, u.id, photo);
			await tx`update volunteer_reports set status = 'approved' where id = ${again.id}`;
			await expectCode(tx, '23505', () => report(tx, i.id, u.id));
			const j = await invite(tx, (await request(tx)).id, u.id);
			await expectCode(tx, '23514', () => report(tx, j.id, u.id, { file_key: 'k' }));
			await expectCode(tx, '23514', () => report(tx, j.id, u.id, { url: null }));
		});
	});

	it('points: volunteer reasons are accepted once per source', async () => {
		await inRollback(async (tx) => {
			const u = await newUser(tx);
			const entry = (reason: string, source_type: string, source_id: string) =>
				insert(tx, 'points_ledger', { user_id: u.id, delta: 10, reason, source_type, source_id });
			const [inv, rep] = [uid(), uid()];
			await entry('volunteer_participation', 'volunteer_invitation', inv);
			await entry('volunteer_report', 'volunteer_report', rep);
			await expectCode(tx, '23505', () =>
				entry('volunteer_participation', 'volunteer_invitation', inv)
			);
		});
	});
});
