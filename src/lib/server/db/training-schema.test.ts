import { existsSync } from 'node:fs';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.DATABASE_URL;

class Rollback extends Error {}

/* docs/02 section 11, docs/03 section 18; NOT NULL, checks, same-course topic — todo.md 9.1. */
describe.skipIf(!url)('training course schema (migration 0016)', () => {
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
	const insert = (tx: postgres.TransactionSql, table: string, values: Record<string, unknown>) =>
		tx`insert into ${tx(table)} ${tx(values)} returning *`.then((r) => r[0]);
	const course = (tx: postgres.TransactionSql, values: Record<string, unknown> = {}) =>
		insert(tx, 'courses', {
			slug: `t-${uid()}`,
			exam_kind: 'trainer',
			title: tx.json({ ru: 'Тренер' }),
			...values
		});
	const topic = (tx: postgres.TransactionSql, courseId: string, values = {}) =>
		insert(tx, 'course_topics', { course_id: courseId, title: tx.json({ ru: 'Тема' }), ...values });
	const lesson = (tx: postgres.TransactionSql, courseId: string, values = {}) =>
		insert(tx, 'course_lessons', {
			course_id: courseId,
			title: tx.json({ ru: 'Урок' }),
			...values
		});
	const options = (tx: postgres.TransactionSql, n: number) =>
		tx.json(Array.from({ length: n }, (_, i) => ({ ru: `Вариант ${i}` })));
	const question = (
		tx: postgres.TransactionSql,
		c: postgres.Row,
		t: postgres.Row,
		values: Record<string, unknown> = {}
	) =>
		insert(tx, 'quiz_questions', {
			course_id: c.id,
			topic_id: t.id,
			text: tx.json({ ru: 'Вопрос?' }),
			options: options(tx, 3),
			correct_index: 0,
			...values
		});

	it('a course starts as a draft with the trainer defaults; slug unique', async () => {
		await inRollback(async (tx) => {
			const row = await course(tx, { slug: 't-course-slug' });
			expect(row).toMatchObject({
				status: 'draft',
				description: {},
				quiz_size: 27,
				pass_count: 25,
				quiz_minutes: 60,
				retake_days: 30,
				attempts_limit: 3,
				attempts_period_days: 180,
				requires_membership: true,
				min_age: null,
				required_level: null
			});
			for (const key of ['created_at', 'updated_at']) expect(row[key]).toBeInstanceOf(Date);
			await expectCode(tx, '23505', () => course(tx, { slug: 't-course-slug' }));
			await expectCode(tx, '23502', () => course(tx, { title: null }));
			await expectCode(tx, '23502', () => course(tx, { exam_kind: null }));
			await expectCode(tx, '22P02', () => course(tx, { exam_kind: 'coach' }));
		});
	});

	it('course numbers stay sane: 1 ≤ pass_count ≤ quiz_size, positive time and limits', async () => {
		await inRollback(async (tx) => {
			await course(tx, { quiz_size: 5, pass_count: 5, retake_days: 0 });
			await course(tx, { min_age: 18, required_level: 'advanced', requires_membership: false });
			const bad = [
				{ quiz_size: 0, pass_count: 0 },
				{ quiz_size: 5, pass_count: 6 },
				{ pass_count: 0 },
				{ quiz_minutes: 0 },
				{ retake_days: -1 },
				{ attempts_limit: 0 },
				{ attempts_period_days: 0 },
				{ min_age: 0 }
			];
			for (const values of bad) await expectCode(tx, '23514', () => course(tx, values));
			await expectCode(tx, '22P02', () => course(tx, { required_level: 'master' }));
		});
	});

	it('topics: visible, ordered, title and course required', async () => {
		await inRollback(async (tx) => {
			const c = await course(tx);
			const row = await topic(tx, c.id);
			expect(row).toMatchObject({ sort_order: 0, hidden_at: null });
			for (const key of ['created_at', 'updated_at']) expect(row[key]).toBeInstanceOf(Date);
			await expectCode(tx, '23502', () => topic(tx, c.id, { title: null }));
			await expectCode(tx, '23502', () => topic(tx, c.id, { course_id: null }));
			await expectCode(tx, '23503', () => topic(tx, uid()));
		});
	});

	it('lessons: draft without topic or file; topic of the same course; file key with its name', async () => {
		await inRollback(async (tx) => {
			const [c, other] = [await course(tx), await course(tx)];
			const row = await lesson(tx, c.id);
			expect(row).toMatchObject({
				status: 'draft',
				topic_id: null,
				body: null,
				file_key: null,
				file_name: null,
				sort_order: 0,
				created_by: null,
				deleted_at: null
			});
			const own = await topic(tx, c.id);
			const foreign = await topic(tx, other.id);
			await lesson(tx, c.id, { topic_id: own.id });
			await expectCode(tx, '23503', () => lesson(tx, c.id, { topic_id: foreign.id }));
			const key = `training/${c.id}/${uid()}.pdf`;
			await lesson(tx, c.id, { file_key: key, file_name: 'first-aid.pdf' });
			await expectCode(tx, '23514', () => lesson(tx, c.id, { file_key: key }));
			await expectCode(tx, '23514', () => lesson(tx, c.id, { file_name: 'first-aid.pdf' }));
			await expectCode(tx, '23502', () => lesson(tx, c.id, { title: null }));
		});
	});

	it('questions: 2–6 options, correct index inside them, topic of the same course', async () => {
		await inRollback(async (tx) => {
			const [c, other] = [await course(tx), await course(tx)];
			const [t, foreign] = [await topic(tx, c.id), await topic(tx, other.id)];
			const row = await question(tx, c, t, { options: options(tx, 2), correct_index: 1 });
			expect(row).toMatchObject({ hidden_at: null, source: null, created_by: null });
			await question(tx, c, t, { options: options(tx, 6), correct_index: 5 });
			for (const values of [
				{ options: options(tx, 1) },
				{ options: options(tx, 7) },
				{ options: tx.json({ ru: 'Вариант' }) },
				{ correct_index: 3 },
				{ correct_index: -1 }
			]) {
				await expectCode(tx, '23514', () => question(tx, c, t, values));
			}
			await expectCode(tx, '23503', () => question(tx, c, foreign));
			await expectCode(tx, '23502', () => question(tx, c, t, { topic_id: null }));
			await expectCode(tx, '23502', () => question(tx, c, t, { text: null }));
		});
	});

	it('a course with topics and a topic with questions are not hard-deleted', async () => {
		await inRollback(async (tx) => {
			const c = await course(tx);
			const t = await topic(tx, c.id);
			await question(tx, c, t);
			await expectCode(tx, '23503', () => tx`delete from course_topics where id = ${t.id}`);
			await expectCode(tx, '23503', () => tx`delete from courses where id = ${c.id}`);
		});
	});
});
