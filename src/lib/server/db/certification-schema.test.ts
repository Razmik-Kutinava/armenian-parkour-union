import { existsSync } from 'node:fs';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.DATABASE_URL;

class Rollback extends Error {}

/* docs/02 sections 1–2, docs/03 sections 3–5. Every test is rolled back. */
describe.skipIf(!url)('exams, certificates and staff profiles schema (migration 0012)', () => {
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
	const newExam = (tx: postgres.TransactionSql, values: Record<string, unknown>) =>
		tx`insert into exams ${tx({ kind: 'level_advanced', ...values })} returning *`.then(
			(r) => r[0]
		);
	const issue = (tx: postgres.TransactionSql, values: Record<string, unknown>) =>
		tx`insert into certificates ${tx({
			kind: 'level',
			level: 'advanced',
			number: `APU-T-${crypto.randomUUID()}`,
			public_token: crypto.randomUUID(),
			issued_at: new Date(),
			...values
		})} returning *`.then((r) => r[0]);

	it('an exam starts scheduled; score keeps two decimals; a user with exams stays', async () => {
		await inRollback(async (tx) => {
			const user = await newUser(tx);
			const exam = await newExam(tx, { user_id: user.id, score: '87.25' });
			expect(exam).toMatchObject({ result: 'scheduled', event_id: null, decided_at: null });
			expect(Number(exam.score)).toBe(87.25);
			for (const key of ['created_at', 'updated_at']) expect(exam[key]).toBeInstanceOf(Date);
			await expectCode(tx, '22P02', () => newExam(tx, { user_id: user.id, kind: 'level_novice' }));
			await expectCode(tx, '23503', () => tx`delete from users where id = ${user.id}`);
		});
	});

	it('a staff profile is hidden and active by default; one per user and kind', async () => {
		await inRollback(async (tx) => {
			const user = await newUser(tx);
			const [trainer] = await tx`insert into staff_profiles (user_id, kind)
				values (${user.id}, 'trainer') returning *`;
			expect(trainer).toMatchObject({ is_public: false, is_active: true, bio: null });
			await tx`insert into staff_profiles (user_id, kind) values (${user.id}, 'judge')`;
			await expectCode(
				tx,
				'23505',
				() => tx`insert into staff_profiles (user_id, kind) values (${user.id}, 'trainer')`
			);
		});
	});

	it('level is set only on level certificates, never novice; level ones never expire', async () => {
		await inRollback(async (tx) => {
			const [user, admin] = [await newUser(tx), await newUser(tx)];
			const base = { user_id: user.id, issued_by: admin.id };
			const cert = await issue(tx, base);
			expect(cert).toMatchObject({ status: 'active', revoked_at: null, file_key: null });
			await issue(tx, { ...base, kind: 'trainer', level: null, expires_at: new Date() });
			for (const values of [
				{ level: null },
				{ level: 'novice' },
				{ level: 'pro', expires_at: new Date() },
				{ kind: 'judge' }
			])
				await expectCode(tx, '23514', () => issue(tx, { ...base, ...values }));
			await expectCode(tx, '23505', () =>
				issue(tx, { ...base, level: 'pro', number: cert.number })
			);
			await expectCode(tx, '23505', () =>
				issue(tx, { ...base, level: 'pro', public_token: cert.public_token })
			);
		});
	});

	it('a revoked certificate needs a time and a reason', async () => {
		await inRollback(async (tx) => {
			const [user, admin] = [await newUser(tx), await newUser(tx)];
			const cert = await issue(tx, { user_id: user.id, issued_by: admin.id });
			const revoke = (values: Record<string, unknown>) =>
				tx`update certificates set ${tx({ status: 'revoked', ...values })} where id = ${cert.id}`;
			await expectCode(tx, '23514', () => revoke({}));
			await expectCode(tx, '23514', () => revoke({ revoked_at: new Date(), revoke_reason: ' ' }));
			await expectCode(tx, '23514', () => revoke({ revoke_reason: 'Fraud' }));
			await revoke({ revoked_at: new Date(), revoke_reason: 'Fraud' });
		});
	});

	it('one live certificate per exam and per level; revoking frees the slot', async () => {
		await inRollback(async (tx) => {
			const [user, admin] = [await newUser(tx), await newUser(tx)];
			const exam = await newExam(tx, { user_id: user.id, result: 'passed' });
			const base = { user_id: user.id, issued_by: admin.id, exam_id: exam.id };
			const cert = await issue(tx, base);
			await expectCode(tx, '23505', () => issue(tx, { ...base, level: 'pro' }));
			await expectCode(tx, '23505', () => issue(tx, { ...base, exam_id: null }));
			await tx`update certificates set status = 'revoked', revoked_at = now(),
				revoke_reason = 'Reissue' where id = ${cert.id}`;
			await issue(tx, base);
			await expectCode(tx, '23503', () => tx`delete from exams where id = ${exam.id}`);
		});
	});
});
