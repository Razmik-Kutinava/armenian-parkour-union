import type { Permission } from '../../src/lib/server/auth/permissions';
import type { AdminAction, NotAuditedAction } from './admin-audit-map';

/*
 * What each admin route asks for (docs/04 section 5): a permission code, or 'staff' for any of
 * editor, moderator, admin. A new admin page, endpoint or action must be added here, or the
 * coverage test fails.
 */
export type Access = Permission | 'staff';

export const ADMIN_READS = {
	'/admin': 'staff',
	'/admin/users': 'users.read_limited',
	'/admin/users/[id]': 'users.read_limited',
	'/admin/users/new': 'users.write',
	'/admin/roles': 'users.set_role',
	'/admin/audit': 'audit.read',
	'/admin/audit/[id]': 'audit.read',
	'GET /admin/audit/export': 'audit.read',
	'/admin/settings': 'settings.write',
	'/admin/media': 'media.write',
	'/admin/media/[id]': 'media.write',
	'/admin/pages': 'pages.write',
	'/admin/pages/new': 'pages.write',
	'/admin/pages/[id]': 'pages.write',
	'/admin/news': 'posts.write',
	'/admin/news/new': 'posts.write',
	'/admin/news/[id]': 'posts.write',
	'/admin/news/[id]/preview': 'posts.write',
	'/admin/events': 'events.write',
	'/admin/events/new': 'events.write',
	'/admin/events/[id]': 'events.write',
	'/admin/events/[id]/preview': 'events.write'
} as const satisfies Record<string, Access>;

export const ADMIN_WRITES = {
	'/admin/users/[id]?/update': 'users.write',
	'/admin/users/[id]?/role': 'users.set_role',
	'/admin/users/[id]?/block': 'users.block',
	'/admin/users/[id]?/unblock': 'users.block',
	'/admin/users/[id]?/confirmEmail': 'users.write',
	'/admin/users/[id]?/passwordLink': 'users.write',
	'/admin/users/new?/default': 'users.write',
	'/admin/roles?/grant': 'users.set_role',
	'/admin/roles?/revoke': 'users.set_role',
	'/admin/settings?/default': 'settings.write',
	'/admin/media?/sign': 'media.write',
	'/admin/media?/complete': 'media.write',
	'/admin/media/[id]?/alt': 'media.write',
	'/admin/media/[id]?/delete': 'media.write',
	'/admin/pages/new?/default': 'pages.write',
	'/admin/pages/[id]?/update': 'pages.write',
	'/admin/pages/[id]?/delete': 'pages.write',
	'/admin/news/new?/default': 'posts.write',
	'/admin/news/[id]?/update': 'posts.write',
	'/admin/news/[id]?/status': 'posts.write',
	'/admin/news/[id]?/duplicate': 'posts.write',
	'/admin/news/[id]?/delete': 'posts.write',
	'/admin/events/new?/default': 'events.write',
	'/admin/events/[id]?/update': 'events.write',
	'/admin/events/[id]?/categoryCreate': 'events.write',
	'/admin/events/[id]?/categoryUpdate': 'events.write',
	'/admin/events/[id]?/categoryDelete': 'events.write',
	'/admin/events/[id]?/status': 'events.write',
	'/admin/events/[id]?/duplicate': 'events.write',
	'/admin/events/[id]?/delete': 'events.write',
	'/admin/events/[id]?/cancel': 'events.cancel',
	'/admin/events/[id]?/finish': 'events.cancel',
	'/admin/events/[id]?/archive': 'events.cancel',
	'/admin/events/[id]?/restore': 'events.cancel',
	'POST /admin/locale': 'staff'
} as const satisfies Record<AdminAction | NotAuditedAction, Access>;
