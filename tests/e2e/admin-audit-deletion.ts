import type postgres from 'postgres';
import type { AdminAction } from './admin-audit-map';

type DeletionAction = Extract<
	AdminAction,
	'/admin/users/[id]?/deleteAccount' | '/admin/users/[id]?/declineDeletion'
>;
type Post = (path: string, form?: Record<string, string>) => Promise<void>;

/** Account deletion requests for admin-audit.spec.ts (decisions.md 2026-10-22). */
export function deletionActions(
	sql: postgres.Sql,
	post: Post,
	postRedirect: Post,
	target: string
): Record<DeletionAction, () => Promise<void>> {
	return {
		/* A separate account: the target stays for the other actions. */
		'/admin/users/[id]?/deleteAccount': async () => {
			const [gone] = await sql`
				insert into users (email, name, deletion_requested_at)
				values (${`e2e-audit-delete-${crypto.randomUUID()}@example.com`}, 'Audit Delete', now())
				returning id`;
			await postRedirect(`/admin/users/${gone.id}?/deleteAccount`);
		},
		'/admin/users/[id]?/declineDeletion': async () => {
			await sql`update users set deletion_requested_at = now() where id = ${target}`;
			await post(`/admin/users/${target}?/declineDeletion`);
		}
	};
}
