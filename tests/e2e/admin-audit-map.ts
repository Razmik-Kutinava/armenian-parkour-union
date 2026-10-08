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
	'/admin/settings?/default': ['settings.update'],
	'/admin/media?/complete': ['media.upload'],
	'/admin/media/[id]?/alt': ['media.update'],
	'/admin/media/[id]?/delete': ['media.delete'],
	'/admin/pages/new?/default': ['page.create'],
	'/admin/pages/[id]?/update': ['page.update'],
	'/admin/pages/[id]?/delete': ['page.delete'],
	'/admin/news/new?/default': ['post.create'],
	'/admin/news/[id]?/update': ['post.update'],
	'/admin/news/[id]?/status': ['post.update'],
	'/admin/news/[id]?/duplicate': ['post.create'],
	'/admin/news/[id]?/delete': ['post.delete'],
	'/admin/events/new?/default': ['event.create'],
	'/admin/events/[id]?/update': ['event.update'],
	'/admin/events/[id]?/categoryCreate': ['event_category.create'],
	'/admin/events/[id]?/categoryUpdate': ['event_category.update'],
	'/admin/events/[id]?/categoryDelete': ['event_category.delete'],
	'/admin/events/[id]?/status': ['event.update'],
	'/admin/events/[id]?/duplicate': ['event.create'],
	'/admin/events/[id]?/cancel': ['event.cancel'],
	'/admin/events/[id]?/finish': ['event.update'],
	'/admin/events/[id]?/archive': ['event.update'],
	'/admin/events/[id]?/restore': ['event.update'],
	'/admin/events/[id]?/delete': ['event.delete']
} as const;

export type AdminAction = keyof typeof ADMIN_AUDIT;

/* Admin endpoints that change nothing of the federation, with the reason. */
export const NOT_AUDITED = {
	'POST /admin/locale': 'own interface language of the staff member',
	'/admin/media?/sign':
		'only issues an upload link; the file enters the library at complete (media.upload)'
} as const satisfies Record<string, string>;

export type NotAuditedAction = keyof typeof NOT_AUDITED;
