import type postgres from 'postgres';

/* A draft partner with a draft perk and a pending card of a member who meets the conditions for
 * admin-permissions.spec.ts: every volunteering action could really run on them. */
export type VolunteerIds = { partnerId: string; perkId: string; cardId: string };

export const volunteerPath = (path: string, ids: VolunteerIds) =>
	path
		.replace('/volunteer/cards/[id]', `/volunteer/cards/${ids.cardId}`)
		.replace('/volunteer/partners/[id]', `/volunteer/partners/${ids.partnerId}`)
		.replace('/perks/[perkId]', `/perks/${ids.perkId}`);

export function volunteerFixtures(sql: postgres.Sql) {
	return {
		insertVolunteer: async (): Promise<VolunteerIds> => {
			const tag = crypto.randomUUID();
			const [partner] = await sql`insert into volunteer_partners (name)
				values (${`E2e perm partner ${tag.slice(0, 8)}`}) returning id`;
			const [perk] = await sql`insert into volunteer_perks (partner_id, title, kind)
				values (${partner.id}, ${sql.json({ en: 'E2e perm perk' })}, 'reusable') returning id`;
			const [user] = await sql`insert into users
				(email, name, first_name, last_name, birth_date, email_verified, avatar_key)
				values (${`e2e-perm-vcard-${tag}@example.com`}, 'Perm Card', 'Perm', 'Card',
					'1990-01-01', true, ${`avatars/${tag}.jpg`}) returning id`;
			await sql`insert into memberships (user_id, status, starts_at, ends_at)
				values (${user.id}, 'active', now() - interval '1 day', now() + interval '300 days')`;
			const [card] = await sql`insert into volunteer_cards (user_id, applied_at)
				values (${user.id}, now()) returning id`;
			return { partnerId: partner.id, perkId: perk.id, cardId: card.id };
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
			audit:
				await sql`select 1 from audit_log where entity_id in (${ids.partnerId}, ${ids.perkId}, ${ids.cardId})`
		})
	};
}
