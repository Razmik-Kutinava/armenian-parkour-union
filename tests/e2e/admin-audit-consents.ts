import type postgres from 'postgres';
import type { AdminAction } from './admin-audit-map';

type ConsentAction = Extract<AdminAction, `/admin/consents${string}`>;
type Post = (path: string, form?: Record<string, string>) => Promise<void>;

/** Consent decisions for admin-audit.spec.ts: each on its own pending consent written by SQL. */
export function consentActions(
	sql: postgres.Sql,
	post: Post,
	target: string
): Record<ConsentAction, () => Promise<void>> {
	const pending = async () =>
		(
			await sql`insert into consents (user_id, kind, file_key, signed_at)
				values (${target}, 'medical', ${`consents/${target}/${crypto.randomUUID()}.pdf`}, now())
				returning id`
		)[0].id as string;
	return {
		'/admin/consents/[id]?/approve': async () =>
			post(`/admin/consents/${await pending()}?/approve`, { validUntil: '' }),
		'/admin/consents/[id]?/reject': async () =>
			post(`/admin/consents/${await pending()}?/reject`, { note: 'Audit check' })
	};
}
