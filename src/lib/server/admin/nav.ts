import type { MessageKey } from '#lib/i18n/translate.ts';
import { can, isStaff, type Permission } from '../auth/permissions';
import type { LocalsUser } from '../auth/session';

export type AdminIcon =
	| 'dashboard'
	| 'hero'
	| 'news'
	| 'pages'
	| 'events'
	| 'media'
	| 'users'
	| 'exams'
	| 'certificates'
	| 'staff'
	| 'consents'
	| 'training'
	| 'trainingAccess'
	| 'videos'
	| 'registrations'
	| 'points'
	| 'pointRules'
	| 'products'
	| 'orders'
	| 'payments'
	| 'donations'
	| 'settings'
	| 'audit'
	| 'roles';

export type NavItem = { key: MessageKey; href: string; icon: AdminIcon };
export type NavGroup = { key: MessageKey; items: NavItem[] };

type Section = NavItem & { permission: Permission | null };

const section = (icon: AdminIcon, path: string, permission: Permission | null): Section => ({
	key: `admin.nav.${icon}` as MessageKey,
	href: path ? `/admin/${path}` : '/admin',
	icon,
	permission
});

/* docs/05 section 2; addresses — docs/decisions.md, 1.9. The menu is a convenience, not protection. */
const sections: [MessageKey, Section[]][] = [
	['admin.group.overview', [section('dashboard', '', null)]],
	[
		'admin.group.content',
		[
			section('hero', 'hero', 'hero.write'),
			section('news', 'news', 'posts.write'),
			section('pages', 'pages', 'pages.write'),
			section('events', 'events', 'events.write'),
			section('media', 'media', 'media.write')
		]
	],
	[
		'admin.group.members',
		[
			section('users', 'users', 'users.read_limited'),
			section('exams', 'exams', 'exams.manage'),
			section('certificates', 'certificates', 'certificates.read'),
			/* docs/04 section 3: moderator and admin view; section 5.1 has no read code of its own. */
			section('staff', 'staff', 'certificates.read'),
			section('consents', 'consents', 'consents.review')
		]
	],
	/* docs/05 section 27: editors reach the lessons through the course list. */
	[
		'admin.group.training',
		[
			section('training', 'training', 'training.lessons'),
			section('trainingAccess', 'training/access', 'training.manage')
		]
	],
	[
		'admin.group.moderation',
		[
			section('videos', 'videos', 'videos.moderate'),
			section('registrations', 'registrations', 'registrations.read')
		]
	],
	[
		'admin.group.shop',
		[
			section('points', 'points', 'points.read'),
			section('pointRules', 'point-rules', 'points.read'),
			section('products', 'products', 'shop.items_write'),
			section('orders', 'orders', 'shop.orders_manage')
		]
	],
	[
		'admin.group.money',
		[
			section('payments', 'payments', 'payments.read'),
			section('donations', 'donation-purposes', 'donations.config')
		]
	],
	[
		'admin.group.system',
		[
			section('settings', 'settings', 'settings.write'),
			section('audit', 'audit', 'audit.read'),
			section('roles', 'roles', 'users.set_role')
		]
	]
];

/** Sections the user may open, grouped; empty groups are dropped. */
export function adminNav(user: LocalsUser): NavGroup[] {
	if (!isStaff(user)) return [];
	return sections
		.map(([key, list]) => ({
			key,
			items: list
				.filter((s) => s.permission === null || can(user, s.permission))
				.map(({ key, href, icon }) => ({ key, href, icon }))
		}))
		.filter((g) => g.items.length > 0);
}
