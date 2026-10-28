import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { courseAccess } from '../../db/schema/training-progress';
import { testDb, testDbUrl } from '../../db/test-db';
import { listAccess } from './access-list';
import { applicant, insertOpenCourse } from './test-support';

/* docs/05 section 27 "Requests"; decisions — docs/todo.md 9.4 (5). */

const NOW = new Date('2026-10-27T12:00:00Z');

async function request(
	tx: LimitDb,
	courseId: string,
	status: 'pending' | 'approved',
	at: string,
	values: Parameters<typeof applicant>[1] = {}
) {
	const user = await applicant(tx, values);
	const reviewed = status === 'pending' ? {} : { reviewedAt: new Date(at) };
	const [row] = await tx
		.insert(courseAccess)
		.values({ courseId, userId: user.id, status, ...reviewed })
		.returning({ id: courseAccess.id });
	await tx
		.update(courseAccess)
		.set({ updatedAt: new Date(at) })
		.where(eq(courseAccess.id, row.id));
	return { id: row.id, user };
}

describe.skipIf(!testDbUrl)('training access: the admin list of requests', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('pending by default, oldest first; status and course filters', async () => {
		await inRollback(async (tx) => {
			const course = await insertOpenCourse(tx);
			const other = await insertOpenCourse(tx);
			const newer = await request(tx, course.id, 'pending', '2026-10-20T10:00:00Z');
			const older = await request(tx, course.id, 'pending', '2026-10-10T10:00:00Z');
			const approved = await request(tx, course.id, 'approved', '2026-10-15T10:00:00Z');
			await request(tx, other.id, 'pending', '2026-10-01T10:00:00Z');
			const ids = async (status: Parameters<typeof listAccess>[1]['status']) =>
				(await listAccess(tx, { status, courseId: course.id, page: 1 }, NOW)).rows.map((r) => r.id);
			expect(await ids('pending')).toEqual([older.id, newer.id]);
			expect(await ids('approved')).toEqual([approved.id]);
			expect(await ids('all')).toEqual([older.id, approved.id, newer.id]);
			const all = await listAccess(tx, { status: 'all', courseId: course.id, page: 1 }, NOW);
			expect(all.total).toBe(3);
		});
	});

	it('a row shows the member, the course, age, level and the membership end', async () => {
		await inRollback(async (tx) => {
			const course = await insertOpenCourse(tx, { title: { ru: 'Курс тренера' } });
			const { id, user } = await request(tx, course.id, 'pending', '2026-10-20T10:00:00Z', {
				name: 'Aram Petrosyan',
				birthDate: '2000-10-28',
				level: 'pro'
			});
			const [row] = (await listAccess(tx, { status: 'pending', courseId: course.id, page: 1 }, NOW))
				.rows;
			expect(row).toMatchObject({
				id,
				userId: user.id,
				name: 'Aram Petrosyan',
				courseId: course.id,
				courseTitle: { ru: 'Курс тренера' },
				status: 'pending',
				date: new Date('2026-10-20T10:00:00Z'),
				age: 25,
				level: 'pro',
				reviewNote: null
			});
			expect(row.paidUntil).toBeInstanceOf(Date);
		});
	});

	it('a member without a membership has no end date', async () => {
		await inRollback(async (tx) => {
			const course = await insertOpenCourse(tx);
			await request(tx, course.id, 'pending', '2026-10-20T10:00:00Z', { member: false });
			const [row] = (await listAccess(tx, { status: 'pending', courseId: course.id, page: 1 }, NOW))
				.rows;
			expect(row.paidUntil).toBeNull();
		});
	});
});
