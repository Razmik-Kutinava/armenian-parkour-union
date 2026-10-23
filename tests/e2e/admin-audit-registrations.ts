import type postgres from 'postgres';
import type { AdminAction } from './admin-audit-map';

type RegistrationAction = Extract<AdminAction, `/admin/registrations${string}`>;
type Post = (path: string, form?: Record<string, string>) => Promise<void>;

/**
 * Registration actions for admin-audit.spec.ts on a free published event without a limit. The
 * members are written by SQL (verified, with a membership), the rows to move or cancel too.
 */
export function registrationActions(
	sql: postgres.Sql,
	post: Post
): Record<RegistrationAction, () => Promise<void>> {
	let eventId: string | null = null;
	const event = async () =>
		(eventId ??= (
			await sql`
				insert into events (slug, title, status, published_at, starts_at, ends_at)
				values (${`e2e-audit-${crypto.randomUUID().slice(0, 8)}`}, ${sql.json({ en: 'Audit regs' })},
					'published', now() - interval '1 day', now() + interval '30 days',
					now() + interval '30 days 2 hours')
				returning id`
		)[0].id as string);
	const member = async () => {
		const [user] = await sql`
			insert into users (email, name, first_name, last_name, birth_date, email_verified)
			values (${`e2e-audit-reg-${crypto.randomUUID()}@example.com`}, 'Audit Member', 'Audit',
				'Member', '1990-01-01', true)
			returning id, email`;
		await sql`insert into memberships (user_id, status, starts_at, ends_at)
			values (${user.id}, 'active', now() - interval '1 day', now() + interval '300 days')`;
		return user as unknown as { id: string; email: string };
	};
	/* Started yesterday: the event day marks are open and it can be finished. */
	const startedEvent = async () =>
		(
			await sql`
				insert into events (slug, title, status, published_at, starts_at, ends_at)
				values (${`e2e-audit-${crypto.randomUUID().slice(0, 8)}`}, ${sql.json({ en: 'Audit day' })},
					'published', now() - interval '2 days', now() - interval '1 day',
					now() - interval '20 hours')
				returning id`
		)[0].id as string;
	let dayId: string | null = null;
	const day = async () => (dayId ??= await startedEvent());
	const registration = async (status: 'registered' | 'waitlist' | 'attended', eventId?: string) =>
		(
			await sql`insert into event_registrations (event_id, user_id, status)
				values (${eventId ?? (await event())}, ${(await member()).id}, ${status}) returning id`
		)[0].id as string;
	const tab = async () => `/admin/registrations/${await event()}`;
	return {
		'/admin/registrations/[id]?/promote': async () =>
			post(`${await tab()}?/promote`, { registrationId: await registration('waitlist') }),
		'/admin/registrations/[id]?/cancel': async () =>
			post(`${await tab()}?/cancel`, {
				registrationId: await registration('registered'),
				comment: 'Audit check'
			}),
		'/admin/registrations/[id]?/add': async () =>
			post(`${await tab()}?/add`, { member: (await member()).email, categoryId: '' }),
		'/admin/registrations/[id]/day?/mark': async () =>
			post(`/admin/registrations/${await day()}/day?/mark`, {
				registrationId: await registration('registered', await day()),
				came: '1'
			}),
		'/admin/registrations/[id]/results?/save': async () => {
			const id = await registration('attended', await day());
			await post(`/admin/registrations/${await day()}/results?/save`, {
				registrationId: id,
				[`place.${id}`]: '1',
				[`score.${id}`]: '9.5'
			});
		},
		'/admin/registrations/[id]/results?/finish': async () =>
			post(`/admin/registrations/${await startedEvent()}/results?/finish`)
	};
}
