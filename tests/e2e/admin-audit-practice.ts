import type postgres from 'postgres';
import type { AdminAction } from './admin-audit-map';

export type PracticeAction = Extract<
	AdminAction,
	`/admin/training/[id]/tasks${string}` | `/admin/training/practice${string}`
>;
type Post = (path: string, form?: Record<string, string>) => Promise<void>;

/**
 * Practice tasks and the review for admin-audit.spec.ts: a draft course written by SQL, the task by
 * the form; each decision on its own pending video of a member written by SQL.
 */
export function practiceActions(
	sql: postgres.Sql,
	post: Post,
	postRedirect: Post
): Record<PracticeAction, () => Promise<void>> {
	const slug = `e2e-audit-practice-${crypto.randomUUID().slice(0, 8)}`;
	let courseId: string | null = null;
	const course = async () => {
		courseId ??= (
			await sql`insert into courses (slug, exam_kind, title)
				values (${slug}, 'trainer', ${sql.json({ en: 'Audit practice course' })}) returning id`
		)[0].id as string;
		return `/admin/training/${courseId}`;
	};
	const taskId = async () =>
		(
			await sql`select t.id from practice_tasks t join courses c on c.id = t.course_id
				where c.slug = ${slug}`
		)[0].id as string;
	const taskForm = { 'title.en': 'Audit task', 'description.en': '<p>Kong</p>', sortOrder: '0' };
	const pending = async () => {
		const [user] = await sql`insert into users (email, name)
			values (${`e2e-audit-practice-${crypto.randomUUID()}@example.com`}, 'Audit Practice')
			returning id`;
		const [row] = await sql`insert into practice_submissions (task_id, user_id, url, platform)
			values (${await taskId()}, ${user.id}, ${`https://www.youtube.com/watch?v=${'a'.repeat(11)}`},
				'youtube') returning id`;
		return `/admin/training/practice/${row.id}`;
	};

	return {
		'/admin/training/[id]/tasks/new?/default': async () =>
			postRedirect(`${await course()}/tasks/new`, taskForm),
		'/admin/training/[id]/tasks/[taskId]?/update': async () =>
			post(`${await course()}/tasks/${await taskId()}?/update`, { ...taskForm, sortOrder: '3' }),
		'/admin/training/[id]/tasks?/hide': async () =>
			post(`${await course()}/tasks?/hide`, { taskId: await taskId() }),
		'/admin/training/[id]/tasks?/restore': async () =>
			post(`${await course()}/tasks?/restore`, { taskId: await taskId() }),
		'/admin/training/practice/[id]?/approve': async () => post(`${await pending()}?/approve`),
		'/admin/training/practice/[id]?/reject': async () =>
			post(`${await pending()}?/reject`, { comment: 'Audit return' })
	};
}
