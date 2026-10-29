import type postgres from 'postgres';

/* A draft partner with a draft perk for admin-permissions.spec.ts: every partner and perk action
 * could really run on them. */
export type VolunteerIds = { partnerId: string; perkId: string };

export const volunteerPath = (path: string, ids: VolunteerIds) =>
	path
		.replace('/volunteer/partners/[id]', `/volunteer/partners/${ids.partnerId}`)
		.replace('/perks/[perkId]', `/perks/${ids.perkId}`);

export function volunteerFixtures(sql: postgres.Sql) {
	return {
		insertVolunteer: async (): Promise<VolunteerIds> => {
			const [partner] = await sql`insert into volunteer_partners (name)
				values (${`E2e perm partner ${crypto.randomUUID().slice(0, 8)}`}) returning id`;
			const [perk] = await sql`insert into volunteer_perks (partner_id, title, kind)
				values (${partner.id}, ${sql.json({ en: 'E2e perm perk' })}, 'reusable') returning id`;
			return { partnerId: partner.id, perkId: perk.id };
		},
		/* Without the order: admin-audit.spec.ts moves partners in parallel and renumbers them all. */
		volunteerRows: async (ids: VolunteerIds) => ({
			partner: (
				await sql`select name, logo_key, website, address, status, created_by
					from volunteer_partners where id = ${ids.partnerId}`
			)[0],
			perks:
				await sql`select * from volunteer_perks where partner_id = ${ids.partnerId} order by id`,
			audit: await sql`select 1 from audit_log where entity_id in (${ids.partnerId}, ${ids.perkId})`
		})
	};
}
