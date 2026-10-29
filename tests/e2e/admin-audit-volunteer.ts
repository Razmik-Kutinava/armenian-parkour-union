import type postgres from 'postgres';
import type { AdminAction } from './admin-audit-map';

type VolunteerAction = Extract<AdminAction, `/admin/volunteer${string}`>;
type Post = (path: string, form?: Record<string, string>) => Promise<void>;

/** Cards, partners and perks for admin-audit.spec.ts; partner steps in this order: each needs the
 * previous. Drafts: nothing reaches the check page. */
export function volunteerActions(
	sql: postgres.Sql,
	post: Post,
	postRedirect: Post
): Record<VolunteerAction, () => Promise<void>> {
	const name = `E2e audit partner ${crypto.randomUUID().slice(0, 8)}`;
	const partnerForm = { name, status: 'draft' };
	const perkForm = { 'title.en': 'Audit perk', kind: 'single', usesLimit: '2', status: 'draft' };
	const partner = async () =>
		`/admin/volunteer/partners/${(await sql`select id from volunteer_partners where name = ${name}`)[0].id}`;
	const perk = async () => {
		const [row] = await sql`select p.id from volunteer_perks p
			join volunteer_partners v on v.id = p.partner_id where v.name = ${name}`;
		return `${await partner()}/perks/${row.id}`;
	};
	/* Each card action on its own card of a fresh member who meets the conditions (docs/03 19.1). */
	const cardOf = async (status: 'pending' | 'active') => {
		const tag = crypto.randomUUID();
		const [user] = await sql`insert into users
			(email, name, first_name, last_name, birth_date, email_verified, avatar_key)
			values (${`e2e-audit-vcard-${tag}@example.com`}, ${`Audit card ${tag.slice(0, 8)}`},
				'Audit', 'Card', '1990-01-01', true, ${`avatars/${tag}.jpg`}) returning id`;
		await sql`insert into memberships (user_id, status, starts_at, ends_at)
			values (${user.id}, 'active', now() - interval '1 day', now() + interval '300 days')`;
		const issued = status === 'active' ? { number: `E2E-V-${tag}`, token: tag } : null;
		const [row] = await sql`insert into volunteer_cards
			(user_id, status, applied_at, number, public_token, issued_at)
			values (${user.id}, ${status}, now(), ${issued?.number ?? null}, ${issued?.token ?? null},
				${issued ? sql`now()` : null}) returning id`;
		return `/admin/volunteer/cards/${row.id}`;
	};
	return {
		'/admin/volunteer/cards/[id]?/issue': async () => post(`${await cardOf('pending')}?/issue`),
		'/admin/volunteer/cards/[id]?/reject': async () =>
			post(`${await cardOf('pending')}?/reject`, { comment: 'Audit reject' }),
		'/admin/volunteer/cards/[id]?/revoke': async () =>
			post(`${await cardOf('active')}?/revoke`, { comment: 'Audit revoke' }),
		'/admin/volunteer/partners/new?/default': () =>
			postRedirect('/admin/volunteer/partners/new', partnerForm),
		'/admin/volunteer/partners/[id]?/update': async () =>
			post(`${await partner()}?/update`, { ...partnerForm, website: 'https://example.com' }),
		/* A second partner straight in the table goes last: one move up, one entry. */
		'/admin/volunteer/partners?/move': async () => {
			const [row] = await sql`insert into volunteer_partners (name, sort_order)
				values (${`${name} second`}, 1000000) returning id`;
			await post('/admin/volunteer/partners?/move', { partnerId: row.id, direction: 'up' });
		},
		'/admin/volunteer/partners/[id]/perks/new?/default': async () =>
			postRedirect(`${await partner()}/perks/new`, perkForm),
		'/admin/volunteer/partners/[id]/perks/[perkId]?/update': async () =>
			post(`${await perk()}?/update`, { ...perkForm, usesLimit: '3' })
	};
}
