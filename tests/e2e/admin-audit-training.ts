import { expect } from '@playwright/test';
import type postgres from 'postgres';
import type { AdminAction } from './admin-audit-map';
import type { PracticeAction } from './admin-audit-practice';

type TrainingAction = Exclude<Extract<AdminAction, `/admin/training${string}`>, PracticeAction>;
type Post = (path: string, form?: Record<string, string>) => Promise<void>;
type Raw = (path: string, form?: Record<string, string>) => Promise<number>;

/** Course, topics and lessons for admin-audit.spec.ts, in this order: each step needs the previous. */
export function trainingActions(
	sql: postgres.Sql,
	post: Post,
	postRedirect: Post,
	raw: Raw
): Record<TrainingAction, () => Promise<void>> {
	const slug = `e2e-audit-${crypto.randomUUID().slice(0, 8)}`;
	const courseForm = {
		slug,
		examKind: 'trainer',
		'title.en': 'Audit course',
		status: 'draft',
		quizSize: '27',
		passCount: '25',
		quizMinutes: '60',
		retakeDays: '30',
		attemptsLimit: '3',
		attemptsPeriodDays: '180',
		requiresMembership: 'on',
		minAge: '18',
		requiredLevel: 'advanced'
	};
	const lessonForm = { topicId: '', 'title.en': 'Audit lesson', status: 'draft', sortOrder: '0' };
	const course = async () =>
		`/admin/training/${(await sql`select id from courses where slug = ${slug}`)[0].id}`;
	const topicId = async (en = 'Audit topic') =>
		(
			await sql`select t.id from course_topics t join courses c on c.id = t.course_id
				where c.slug = ${slug} and t.title->>'en' = ${en}`
		)[0].id as string;
	const lessonId = async () =>
		(
			await sql`select l.id from course_lessons l join courses c on c.id = l.course_id
				where c.slug = ${slug} and l.deleted_at is null`
		)[0].id as string;
	const lesson = async () => `${await course()}/lessons/${await lessonId()}`;
	const questionForm = async (correct = '1') => ({
		topicId: await topicId(),
		'text.ru': 'Аудит: вопрос',
		'option0.ru': 'Нет',
		'option1.ru': 'Да',
		correct
	});
	/* A published course without conditions: approve does not depend on memberships. */
	const accessRow = async (status: 'pending' | 'approved') => {
		const [user] = await sql`insert into users (email, name, first_name, last_name, birth_date)
			values (${`e2e-audit-access-${crypto.randomUUID()}@example.com`}, 'Audit Applicant',
				'Audit', 'Applicant', '1990-01-01') returning id`;
		const [course] = await sql`insert into courses
				(slug, exam_kind, title, status, requires_membership)
			values (${`e2e-audit-open-${crypto.randomUUID().slice(0, 8)}`}, 'trainer',
				${sql.json({ en: 'Audit open course' })}, 'published', false) returning id`;
		const [row] = await sql`insert into course_access (course_id, user_id, status, reviewed_at)
			values (${course.id}, ${user.id}, ${status}, ${status === 'pending' ? null : new Date()})
			returning id`;
		return row.id as string;
	};
	const question = async () => {
		const [row] = await sql`select q.id from quiz_questions q join courses c on c.id = q.course_id
			where c.slug = ${slug}`;
		return `${await course()}/questions/${row.id}`;
	};

	return {
		'/admin/training/new?/default': () => postRedirect('/admin/training/new', courseForm),
		'/admin/training/[id]?/update': async () =>
			post(`${await course()}?/update`, { ...courseForm, passCount: '24' }),
		'/admin/training/[id]/topics?/create': async () =>
			post(`${await course()}/topics?/create`, { 'title.en': 'Audit topic' }),
		'/admin/training/[id]/topics?/update': async () =>
			post(`${await course()}/topics?/update`, {
				topicId: await topicId(),
				'title.en': 'Audit topic',
				'title.ru': 'Тема'
			}),
		/* A second topic straight in the table: one move, one entry. */
		'/admin/training/[id]/topics?/move': async () => {
			const [row] = await sql`insert into course_topics (course_id, title, sort_order)
				select id, ${sql.json({ en: 'Audit second' })}, 100 from courses where slug = ${slug}
				returning id`;
			await post(`${await course()}/topics?/move`, { topicId: row.id, direction: 'up' });
		},
		'/admin/training/[id]/topics?/hide': async () =>
			post(`${await course()}/topics?/hide`, { topicId: await topicId() }),
		'/admin/training/[id]/topics?/restore': async () =>
			post(`${await course()}/topics?/restore`, { topicId: await topicId() }),
		'/admin/training/[id]/questions/new?/default': async () =>
			postRedirect(`${await course()}/questions/new`, await questionForm()),
		'/admin/training/[id]/questions/[questionId]?/update': async () =>
			post(`${await question()}?/update`, await questionForm('0')),
		'/admin/training/[id]/questions/[questionId]?/hide': async () =>
			post(`${await question()}?/hide`),
		'/admin/training/[id]/questions/[questionId]?/restore': async () =>
			post(`${await question()}?/restore`),
		'/admin/training/[id]/lessons/new?/default': async () =>
			postRedirect(`${await course()}/lessons/new`, lessonForm),
		'/admin/training/[id]/lessons/[lessonId]?/update': async () =>
			post(`${await lesson()}?/update`, { ...lessonForm, sortOrder: '2' }),
		/* No bucket in tests: the object is never there, so complete is refused and logs nothing.
		   The entry with a stored PDF is covered by services/training/lesson-files.test.ts. */
		'/admin/training/[id]/lessons/[lessonId]?/pdfComplete': async () => {
			const key = `training/${crypto.randomUUID()}/${crypto.randomUUID()}.pdf`;
			expect(await raw(`${await lesson()}?/pdfComplete`, { key, name: 'audit.pdf' })).toBe(400);
		},
		/* The file set in the table: the row is detached and logged, the object removal only warns. */
		'/admin/training/[id]/lessons/[lessonId]?/pdfRemove': async () => {
			const id = await lessonId();
			await sql`update course_lessons set file_key = ${`training/x/${crypto.randomUUID()}.pdf`},
				file_name = 'audit.pdf' where id = ${id}`;
			await post(`${await lesson()}?/pdfRemove`);
		},
		'/admin/training/[id]/lessons/[lessonId]?/delete': async () =>
			postRedirect(`${await lesson()}?/delete`),
		'/admin/training/access?/approve': async () =>
			post('/admin/training/access?/approve', { accessId: await accessRow('pending') }),
		'/admin/training/access?/reject': async () =>
			post('/admin/training/access?/reject', {
				accessId: await accessRow('pending'),
				comment: 'Audit refusal'
			}),
		'/admin/training/access?/revoke': async () =>
			post('/admin/training/access?/revoke', {
				accessId: await accessRow('approved'),
				comment: 'Audit revoke'
			}),
		'/admin/training/access?/extra': async () =>
			post('/admin/training/access?/extra', { accessId: await accessRow('approved') })
	};
}
