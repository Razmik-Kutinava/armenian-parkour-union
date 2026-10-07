import { adminNav } from '#lib/server/admin/nav.ts';
import { requireStaff } from '#lib/server/auth/guard.ts';
import type { LayoutServerLoad } from './$types';

/* Form actions do not run layout loads: each admin action calls requirePermission itself. */
export const load: LayoutServerLoad = ({ locals }) => {
	const user = requireStaff(locals.user);
	return {
		staff: { name: user.name, role: user.role },
		locale: user.locale,
		nav: adminNav(user)
	};
};
