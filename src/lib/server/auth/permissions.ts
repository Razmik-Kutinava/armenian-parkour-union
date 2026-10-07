import type { LocalsUser, UserRole } from './session';

/**
 * docs/04-ROLES-PERMISSIONS.md section 5.1. Change only together with the document, never from the
 * admin panel. A member's own data is checked by owner (section 5.3), not here.
 */
export const permissions = {
	'users.read_limited': ['moderator', 'admin'],
	'users.read_full': ['admin'],
	'users.write': ['admin'],
	'users.block': ['admin'],
	'users.set_level': ['admin'],
	'users.set_role': ['admin'],
	'events.write': ['editor', 'admin'],
	'events.cancel': ['admin'],
	'registrations.read': ['moderator', 'admin'],
	'registrations.manage': ['moderator', 'admin'],
	'exams.manage': ['moderator', 'admin'],
	'certificates.read': ['moderator', 'admin'],
	'certificates.issue': ['admin'],
	'certificates.revoke': ['admin'],
	'staff_profiles.write': ['admin'],
	'points.read': ['moderator', 'admin'],
	'points.adjust': ['admin'],
	'points.rules': ['admin'],
	'videos.moderate': ['moderator', 'admin'],
	'consents.review': ['moderator', 'admin'],
	'payments.read': ['admin'],
	'payments.manage': ['admin'],
	'donations.config': ['admin'],
	'shop.items_write': ['editor', 'admin'],
	'shop.orders_manage': ['moderator', 'admin'],
	'shop.orders_cancel': ['admin'],
	'posts.write': ['editor', 'admin'],
	'pages.write': ['editor', 'admin'],
	'hero.write': ['editor', 'admin'],
	'media.write': ['editor', 'admin'],
	'settings.write': ['admin'],
	'audit.read': ['admin']
} as const satisfies Record<string, readonly UserRole[]>;

export type Permission = keyof typeof permissions;

const STAFF_ROLES: readonly UserRole[] = ['editor', 'moderator', 'admin'];

export function can(user: LocalsUser | null, permission: Permission): boolean {
	return !!user && (permissions[permission] as readonly UserRole[]).includes(user.role);
}

/** Roles that may enter /admin (docs/04 section 5.2). */
export function isStaff(user: LocalsUser | null): user is LocalsUser {
	return !!user && STAFF_ROLES.includes(user.role);
}
