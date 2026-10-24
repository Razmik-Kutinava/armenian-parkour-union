import type postgres from 'postgres';

/* Certificate and staff profile rows for admin-permissions.spec.ts (admin-permissions-fixtures.ts
 * is over its size). */
export type StageSixIds = { certificateId: string; staffId: string };

export const stageSixPath = (path: string, ids: StageSixIds) =>
	path
		.replace('/certificates/[id]', `/certificates/${ids.certificateId}`)
		.replace('/staff/[id]', `/staff/${ids.staffId}`);

export function certificateFixtures(sql: postgres.Sql) {
	return {
		/* Live, with a PDF key, and its hidden coach profile: a remake, a revoke and a profile edit
		 * could really run on them. */
		insertCertificate: async (userId: string): Promise<StageSixIds> => {
			const [cert] = await sql`
				insert into certificates (user_id, kind, number, public_token, issued_at, expires_at,
					issued_by, file_key)
				values (${userId}, 'trainer', ${`E2E-PERM-${crypto.randomUUID()}`}, ${crypto.randomUUID()},
					now(), now() + interval '300 days', ${userId}, ${`certificates/${userId}/perm.pdf`})
				returning id`;
			const [profile] = await sql`
				insert into staff_profiles (user_id, kind) values (${userId}, 'trainer') returning id`;
			return { certificateId: cert.id, staffId: profile.id };
		},
		certificateRows: async (userId: string) => [
			...(await sql`select id, kind, level, status, file_key, revoked_at, revoke_reason
				from certificates where user_id = ${userId} order by id`),
			...(await sql`select id, kind, category, license_number, bio, is_public, is_active
				from staff_profiles where user_id = ${userId} order by id`)
		]
	};
}
