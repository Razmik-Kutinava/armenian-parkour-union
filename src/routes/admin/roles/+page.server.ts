import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { changeRole } from '#lib/server/services/users/account.ts';
import { findMembers, listStaff } from '#lib/server/services/users/staff.ts';
import { accountOutcome } from '../users/outcome';
import type { Actions, PageServerLoad } from './$types';

/* docs/05 section 23. Giving "member" is taking the role away, a separate action. */
const grantSchema = z.object({
	userId: z.string(),
	role: z.enum(['editor', 'moderator', 'admin'])
});
const revokeSchema = z.object({ userId: z.string() });

export const load: PageServerLoad = async ({ locals, url }) => {
	const viewer = requirePermission(locals.user, 'users.set_role');
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
	const [staff, found] = await Promise.all([listStaff(db), findMembers(db, q)]);
	return { staff, found, q, selfId: viewer.id };
};

export const actions: Actions = {
	grant: async (event) => {
		const actor = requirePermission(event.locals.user, 'users.set_role');
		const parsed = grantSchema.safeParse(Object.fromEntries(await event.request.formData()));
		if (!parsed.success) return fail(400, { message: 'users.error.role' as const });
		const { userId, role } = parsed.data;
		return accountOutcome(await changeRole(db, actor, userId, role, event.getClientAddress()));
	},
	revoke: async (event) => {
		const actor = requirePermission(event.locals.user, 'users.set_role');
		const parsed = revokeSchema.safeParse(Object.fromEntries(await event.request.formData()));
		if (!parsed.success) return fail(400, { message: 'users.error.role' as const });
		const ip = event.getClientAddress();
		return accountOutcome(await changeRole(db, actor, parsed.data.userId, 'member', ip));
	}
};
