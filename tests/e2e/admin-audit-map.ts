/*
 * Every admin action that changes data and the audit codes it writes (docs/02 section 10,
 * docs/04 sections 2 and 6). Key: route id and form action, or method and endpoint.
 * A new admin action must be added here, or the coverage test fails.
 */
export const ADMIN_AUDIT = {
	'/admin/users/[id]?/update': ['user.update'],
	'/admin/users/[id]?/role': ['user.role_change'],
	'/admin/users/[id]?/block': ['user.block'],
	'/admin/users/[id]?/unblock': ['user.unblock'],
	'/admin/users/[id]?/confirmEmail': ['user.email_confirm'],
	'/admin/users/[id]?/passwordLink': ['user.password_link'],
	'/admin/users/new?/default': ['user.create'],
	'/admin/roles?/grant': ['user.role_change'],
	'/admin/roles?/revoke': ['user.role_change'],
	'/admin/settings?/default': ['settings.update']
} as const;

export type AdminAction = keyof typeof ADMIN_AUDIT;

/* Admin endpoints that change nothing of the federation, with the reason. */
export const NOT_AUDITED: Record<string, string> = {
	'POST /admin/locale': 'own interface language of the staff member'
};
