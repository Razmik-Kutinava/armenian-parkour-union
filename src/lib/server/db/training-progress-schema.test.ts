import { existsSync } from 'node:fs';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.DATABASE_URL;

class Rollback extends Error {}

/* docs/02 section 11, docs/03 section 18; review notes, one live row, attempt result — todo.md 9.1. */
describe.skipIf(!url)('training progress schema (migration 0016)', () => {
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

	const uid = () => crypto.randomUUID();
	const now = new Date();
	const insert = (tx: postgres.TransactionSql, table: string, values: Record<string, unknown>) =>
		tx`insert into ${tx(table)} ${tx(values)} returning *`.then((r) => r[0]);
	const newUser = (tx: postgres.TransactionSql) =>
		insert(tx, 'users', { email: `t-${uid()}@example.com`, name: 'Test' });
	const course = (tx: postgres.TransactionSql) =>
		insert(tx, 'courses', {
			slug: `t-${uid()}`,
			exam_kind: 'trainer',
			title: tx.json({ ru: 'T' })
		});
	const access = (tx: postgres.TransactionSql, c: string, u: string, values = {}) =>
		insert(tx, 'course_access', { course_id: c, user_id: u, ...values });
	const attempt = (tx: postgres.TransactionSql, c: string, u: string, values = {}) =>
		insert(tx, 'quiz_attempts', {
			course_id: c,
			user_id: u,
			questions: tx.json([
				{ question_id: uid(), text: { ru: 'В?' }, options: [], correct_index: 0 }
			]),
			total: 3,
			pass_count: 2,
			expires_at: new Date(Date.now() + 3_600_000),
			...values
		});
	const task = (tx: postgres.TransactionSql, c: string, values = {}) =>
		insert(tx, 'practice_tasks', {
			course_id: c,
			title: tx.json({ ru: 'Модуль 1' }),
			description: tx.json({ ru: '<p>Покажите</p>' }),
			...values
		});
	const submission = (tx: postgres.TransactionSql, t: string, u: string, values = {}) =>
		insert(tx, 'practice_submissions', {
			task_id: t,
			user_id: u,
			url: `https://www.youtube.com/watch?v=${uid().slice(0, 11)}`,
			platform: 'youtube',
			...values
		});
	const done = { submitted_at: now, correct_count: 2, passed: true };

	it('access: one row per course and member, pending until reviewed, notes for refusals', async () => {
		await inRollback(async (tx) => {
			const [c, u, admin] = [await course(tx), await newUser(tx), await newUser(tx)];
			const row = await access(tx, c.id, u.id);
			expect(row).toMatchObject({
				status: 'pending',
				reviewed_by: null,
				reviewed_at: null,
				review_note: null,
				extra_attempts: 0,
				exam_id: null
			});
			await expectCode(tx, '23505', () => access(tx, c.id, u.id));
			const reviewed = { reviewed_by: admin.id, reviewed_at: now };
			for (const status of ['rejected', 'revoked']) {
				const other = await newUser(tx);
				await access(tx, c.id, other.id, { status, ...reviewed, review_note: 'Нет степени' });
				await expectCode(tx, '23514', () => access(tx, c.id, other.id, { status, ...reviewed }));
				const blank = { status, ...reviewed, review_note: '  ' };
				await expectCode(tx, '23514', () => access(tx, c.id, uid(), blank));
			}
			const fresh = async () => (await newUser(tx)).id;
			await access(tx, c.id, await fresh(), { status: 'approved', ...reviewed });
			await expectCode(tx, '23514', () => access(tx, c.id, uid(), { status: 'approved' }));
			await expectCode(tx, '23514', () => access(tx, c.id, uid(), { reviewed_at: now }));
			const minus = { extra_attempts: -1 };
			await expectCode(tx, '23514', async () => access(tx, c.id, await fresh(), minus));
			await expectCode(tx, '22P02', async () =>
				access(tx, c.id, await fresh(), { status: 'open' })
			);
		});
	});

	it('one course exam per access row; an exam and a member with history are not hard-deleted', async () => {
		await inRollback(async (tx) => {
			const [c, u, v] = [await course(tx), await newUser(tx), await newUser(tx)];
			const [exam] = await tx`insert into exams (user_id, kind, result)
				values (${u.id}, 'trainer', 'passed') returning id`;
			await access(tx, c.id, u.id, { exam_id: exam.id });
			await expectCode(tx, '23505', () => access(tx, c.id, v.id, { exam_id: exam.id }));
			await expectCode(tx, '23503', () => access(tx, c.id, v.id, { exam_id: uid() }));
			await expectCode(tx, '23503', () => tx`delete from exams where id = ${exam.id}`);
			await attempt(tx, c.id, v.id);
			await expectCode(tx, '23503', () => tx`delete from users where id = ${v.id}`);
		});
	});

	it('attempts: one running per course and member; the result is all set or all empty', async () => {
		await inRollback(async (tx) => {
			const [c, u] = [await course(tx), await newUser(tx)];
			const finished = await attempt(tx, c.id, u.id, done);
			expect(finished).toMatchObject({ is_extra: false, answers: null });
			expect(finished.started_at).toBeInstanceOf(Date);
			const running = await attempt(tx, c.id, u.id, { answers: tx.json([0, null, 2]) });
			expect(running).toMatchObject({ passed: null, correct_count: null, submitted_at: null });
			await expectCode(tx, '23505', () => attempt(tx, c.id, u.id, { is_extra: true }));
			for (const values of [
				{ ...done, submitted_at: null },
				{ ...done, correct_count: null },
				{ ...done, passed: false },
				{ ...done, correct_count: 1 },
				{ ...done, correct_count: 4, passed: true },
				{ pass_count: 4, ...done, passed: false },
				{ pass_count: 0, ...done },
				{ total: 0, pass_count: 0, ...done, correct_count: 0 },
				{ ...done, started_at: now, expires_at: now },
				{ ...done, questions: tx.json({ a: 1 }) },
				{ ...done, answers: tx.json({ a: 1 }) }
			]) {
				await expectCode(tx, '23514', () => attempt(tx, c.id, u.id, values));
			}
			await attempt(tx, c.id, u.id, { ...done, correct_count: 1, passed: false });
		});
	});

	it('tasks: visible and ordered; title and description required', async () => {
		await inRollback(async (tx) => {
			const c = await course(tx);
			const row = await task(tx, c.id);
			expect(row).toMatchObject({ sort_order: 0, hidden_at: null });
			for (const key of ['created_at', 'updated_at']) expect(row[key]).toBeInstanceOf(Date);
			await expectCode(tx, '23502', () => task(tx, c.id, { title: null }));
			await expectCode(tx, '23502', () => task(tx, c.id, { description: null }));
			await expectCode(tx, '23503', () => task(tx, uid()));
		});
	});

	it('submissions: one pending or approved per task; rejected needs a note; links only', async () => {
		await inRollback(async (tx) => {
			const [c, u, mod] = [await course(tx), await newUser(tx), await newUser(tx)];
			const t = await task(tx, c.id);
			const reviewed = { reviewed_by: mod.id, reviewed_at: now };
			const row = await submission(tx, t.id, u.id);
			expect(row).toMatchObject({ status: 'pending', reviewed_at: null, review_note: null });
			await expectCode(tx, '23505', () => submission(tx, t.id, u.id));
			const refuse = { status: 'rejected', ...reviewed };
			await tx`update practice_submissions set ${tx({ ...refuse, review_note: 'Не видно' })}
				where id = ${row.id}`;
			await expectCode(tx, '23514', () => submission(tx, t.id, u.id, refuse));
			const blank = { ...refuse, review_note: ' ' };
			await expectCode(tx, '23514', () => submission(tx, t.id, u.id, blank));
			const again = await submission(tx, t.id, u.id, { platform: 'google_drive' });
			await tx`update practice_submissions set ${tx({ status: 'approved', ...reviewed })}
				where id = ${again.id}`;
			await expectCode(tx, '23505', () => submission(tx, t.id, u.id));
			const other = (await newUser(tx)).id;
			await expectCode(tx, '23514', () => submission(tx, t.id, other, { status: 'approved' }));
			await expectCode(tx, '23514', () => submission(tx, t.id, other, { reviewed_at: now }));
			await expectCode(tx, '23514', () => submission(tx, t.id, other, { platform: 'vimeo' }));
			await expectCode(tx, '23502', () => submission(tx, t.id, other, { url: null }));
		});
	});
});
