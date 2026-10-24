import type postgres from 'postgres';
import type { AdminAction } from './admin-audit-map';

type ExamAction = Extract<AdminAction, `/admin/exams${string}`>;
type Post = (path: string, form?: Record<string, string>) => Promise<void>;

/**
 * Exam actions for admin-audit.spec.ts: a member written by SQL (with a membership), a trainer
 * exam (no level warning); the result goes on an exam held yesterday.
 */
export function examActions(
	sql: postgres.Sql,
	post: Post
): Record<ExamAction, () => Promise<void>> {
	const member = async () => {
		const [user] = await sql`
			insert into users (email, name, first_name, last_name, birth_date, email_verified)
			values (${`e2e-audit-exam-${crypto.randomUUID()}@example.com`}, 'Audit Examinee', 'Audit',
				'Examinee', '1990-01-01', true)
			returning id`;
		await sql`insert into memberships (user_id, status, starts_at, ends_at)
			values (${user.id}, 'active', now() - interval '1 day', now() + interval '300 days')`;
		return user.id as string;
	};
	return {
		'/admin/exams/new?/default': async () =>
			post('/admin/exams/new', {
				userId: await member(),
				kind: 'trainer',
				scheduledAt: '2099-05-01T10:00',
				eventId: '',
				examinerId: '',
				notes: 'Audit check'
			}),
		'/admin/exams/[id]?/result': async () => {
			const [exam] = await sql`insert into exams (user_id, kind, scheduled_at)
				values (${await member()}, 'trainer', now() - interval '1 day') returning id`;
			await post(`/admin/exams/${exam.id}?/result`, {
				result: 'failed',
				score: '',
				comment: 'Audit check'
			});
		}
	};
}
