import { error, redirect } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import { can, isStaff, type Permission } from './permissions';
import type { LocalsUser } from './session';

/* docs/04 section 5.4: guest → login with return address; others → 404 or 403, no details. */

function toLogin(): never {
	const { url } = getRequestEvent();
	redirect(303, `/login?returnTo=${encodeURIComponent(url.pathname + url.search)}`);
}

/** Entry to /admin: guest → login, member → 404 (decision 2026-10-06). */
export function requireStaff(user: LocalsUser | null): LocalsUser {
	if (!user) toLogin();
	if (!isStaff(user)) error(404, 'Not found');
	return user;
}

/** Every admin page and form action checks its own permission; the layout check is not enough. */
export function requirePermission(user: LocalsUser | null, permission: Permission): LocalsUser {
	const staff = requireStaff(user);
	if (!can(staff, permission)) error(403, 'Forbidden');
	return staff;
}
