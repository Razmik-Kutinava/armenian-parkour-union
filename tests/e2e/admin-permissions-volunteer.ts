import type postgres from 'postgres';

/* A draft partner with a draft perk and a waiting cashier access, a pending card of a member who
 * meets the conditions and an issued card (its PDF) for admin-permissions.spec.ts: every volunteering
 * action could really run. */
export type VolunteerIds = {
	partnerId: string;
	perkId: string;
	cardId: string;
	issuedId: string;
	requestId: string;
	reportId: string;
};

export const volunteerPath = (path: string, ids: VolunteerIds) =>
	path
		.replace('/volunteer/cards/[id]/pdf', `/volunteer/cards/${ids.issuedId}/pdf`)
		.replace('/volunteer/cards/[id]', `/volunteer/cards/${ids.cardId}`)
		.replace('/volunteer/partners/[id]', `/volunteer/partners/${ids.partnerId}`)
		.replace('/perks/[perkId]', `/perks/${ids.perkId}`)
		.replace('/volunteer/requests/[id]', `/volunteer/requests/${ids.requestId}`)
		.replace('/volunteer/reports/[id]', `/volunteer/reports/${ids.reportId}`);

export function volunteerFixtures(sql: postgres.Sql) {
	return {
		insertVolunteer: async (): Promise<VolunteerIds> => {
			const tag = crypto.randomUUID();
			const [partner] = await sql`insert into volunteer_partners (name)
				values (${`E2e perm partner ${tag.slice(0, 8)}`}) returning id`;
			const [perk] = await sql`insert into volunteer_perks (partner_id, title, kind)
				values (${partner.id}, ${sql.json({ en: 'E2e perm perk' })}, 'reusable') returning id`;
			const member = async (suffix: string) => {
				const [user] = await sql`insert into users
					(email, name, first_name, last_name, birth_date, email_verified, avatar_key)
					values (${`e2e-perm-vcard-${suffix}${tag}@example.com`}, 'Perm Card', 'Perm', 'Card',
						'1990-01-01', true, ${`avatars/${suffix}${tag}.jpg`}) returning id`;
				await sql`insert into memberships (user_id, status, starts_at, ends_at)
					values (${user.id}, 'active', now() - interval '1 day', now() + interval '300 days')`;
				return user.id as string;
			};
			const [card] = await sql`insert into volunteer_cards (user_id, applied_at)
				values (${await member('')}, now()) returning id`;
			const holder = await member('i-');
			const [issued] = await sql`insert into volunteer_cards
				(user_id, applied_at, status, number, public_token, issued_at)
				values (${holder}, now(), 'active', ${`E2E-V-${tag}`}, ${`e2e-${tag}`}, now())
				returning id`;
			await sql`insert into partner_cashiers (partner_id, label, invite_token_hash,
				invite_expires_at, created_by) values (${partner.id}, 'E2e perm till', ${`e2e-${tag}`},
				now() + interval '1 day', ${holder})`;
			const [request] = await sql`insert into volunteer_requests
				(title, starts_at, ends_at, places, respond_by, status)
				values (${sql.json({ en: `E2e perm req ${tag.slice(0, 8)}` })},
					now() + interval '7 days', now() + interval '7 days 4 hours', 2,
					now() + interval '3 days', 'draft') returning id`;
			const [invite] = await sql`insert into volunteer_invitations
				(request_id, user_id, status) values (${request.id}, ${holder}, 'attended')
				returning id`;
			const [report] = await sql`insert into volunteer_reports
				(invitation_id, user_id, url, status)
				values (${invite.id}, ${holder}, ${`https://www.youtube.com/watch?v=e2e${tag.slice(0, 8)}`},
					'pending') returning id`;
			return {
				partnerId: partner.id,
				perkId: perk.id,
				cardId: card.id,
				issuedId: issued.id,
				requestId: request.id,
				reportId: report.id
			};
		},
		/* Without the order: admin-audit.spec.ts moves partners in parallel and renumbers them all. */
		volunteerRows: async (ids: VolunteerIds) => ({
			partner: (
				await sql`select name, logo_key, website, address, status, created_by
					from volunteer_partners where id = ${ids.partnerId}`
			)[0],
			perks:
				await sql`select * from volunteer_perks where partner_id = ${ids.partnerId} order by id`,
			card: (await sql`select * from volunteer_cards where id = ${ids.cardId}`)[0],
			cashiers:
				await sql`select * from partner_cashiers where partner_id = ${ids.partnerId} order by id`,
			audit:
				await sql`select 1 from audit_log where entity_id in (${ids.partnerId}, ${ids.perkId}, ${ids.cardId})`
		})
	};
}
