import type postgres from 'postgres';
import type { AdminAction } from './admin-audit-map';

type VolunteerAction = Extract<AdminAction, `/admin/volunteer${string}`>;
type Post = (path: string, form?: Record<string, string>) => Promise<void>;

/** Partners and perks for admin-audit.spec.ts, in this order: each step needs the previous. Drafts:
 * nothing reaches the check page. */
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
	return {
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
