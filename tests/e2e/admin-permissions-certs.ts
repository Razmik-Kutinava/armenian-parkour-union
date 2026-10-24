import type postgres from 'postgres';

/* Certificate rows for admin-permissions.spec.ts (admin-permissions-fixtures.ts is over its size). */
export function certificateFixtures(sql: postgres.Sql) {
	return {
		/* Live, with a PDF key: a remake and a revoke could really run on it. */
		insertCertificate: async (userId: string) =>
			(
				await sql`
				insert into certificates (user_id, kind, number, public_token, issued_at, expires_at,
					issued_by, file_key)
				values (${userId}, 'trainer', ${`E2E-PERM-${crypto.randomUUID()}`}, ${crypto.randomUUID()},
					now(), now() + interval '300 days', ${userId}, ${`certificates/${userId}/perm.pdf`})
				returning id`
			)[0].id as string,
		certificateRows: async (userId: string) =>
			await sql`select id, kind, level, status, file_key, revoked_at, revoke_reason
				from certificates where user_id = ${userId} order by id`
	};
}
