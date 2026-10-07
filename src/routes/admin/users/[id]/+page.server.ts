import { error, fail } from '@sveltejs/kit';
import { can } from '#lib/server/auth/permissions.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { mailPasswordLink } from '#lib/server/auth/password.ts';
import { db } from '#lib/server/db/index.ts';
import { userHistory, writeAudit } from '#lib/server/services/audit.ts';
import { changeRole, confirmEmail, setBlocked } from '#lib/server/services/users/account.ts';
import { getUserCard } from '#lib/server/services/users/card.ts';
import { updateProfile } from '#lib/server/services/users/edit.ts';
import { blockSchema, profileSchema, roleSchema } from '#lib/validation/admin-users.ts';
import { fieldErrors, keepValues } from '#lib/validation/form.ts';
import { accountOutcome } from '../outcome';
import type { Actions, PageServerLoad } from './$types';

const FIELDS = [
	'firstName',
	'lastName',
	'birthDate',
	'phone',
	'city',
	'guardianName',
	'guardianPhone',
	'guardianEmail'
] as const;

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const viewer = requirePermission(locals.user, 'users.read_limited');
	const card = await getUserCard(db, viewer, params.id);
	if (!card) error(404, 'Not found');
	const canHistory = can(viewer, 'audit.read');
	const tab = canHistory && url.searchParams.get('tab') === 'history' ? 'history' : 'profile';
	return {
		card,
		tab,
		history: tab === 'history' ? await userHistory(db, card.id) : [],
		isSelf: viewer.id === card.id,
		can: {
			history: canHistory,
			edit: can(viewer, 'users.write'),
			role: can(viewer, 'users.set_role'),
			block: can(viewer, 'users.block')
		}
	};
};

export const actions: Actions = {
	update: async (event) => {
		const actor = requirePermission(event.locals.user, 'users.write');
		const form = await event.request.formData();
		const parsed = profileSchema().safeParse(Object.fromEntries(form));
		if (!parsed.success) {
			return fail(400, { values: keepValues(form, FIELDS), errors: fieldErrors(parsed.error) });
		}
		const ip = event.getClientAddress();
		const result = await updateProfile(db, actor, event.params.id, parsed.data, ip);
		return accountOutcome(result);
	},
	role: async (event) => {
		const actor = requirePermission(event.locals.user, 'users.set_role');
		const parsed = roleSchema.safeParse(Object.fromEntries(await event.request.formData()));
		if (!parsed.success) return fail(400, { message: 'users.error.role' as const });
		const ip = event.getClientAddress();
		return accountOutcome(await changeRole(db, actor, event.params.id, parsed.data.role, ip));
	},
	block: async (event) => {
		const actor = requirePermission(event.locals.user, 'users.block');
		const form = await event.request.formData();
		const parsed = blockSchema.safeParse({ reason: form.get('comment') });
		if (!parsed.success) return fail(400, { message: 'users.error.reason' as const });
		const ip = event.getClientAddress();
		const result = await setBlocked(db, actor, event.params.id, true, parsed.data.reason, ip);
		return accountOutcome(result);
	},
	unblock: async (event) => {
		const actor = requirePermission(event.locals.user, 'users.block');
		const ip = event.getClientAddress();
		return accountOutcome(await setBlocked(db, actor, event.params.id, false, null, ip));
	},
	confirmEmail: async (event) => {
		const actor = requirePermission(event.locals.user, 'users.write');
		return accountOutcome(await confirmEmail(db, actor, event.params.id, event.getClientAddress()));
	},
	passwordLink: async (event) => {
		const actor = requirePermission(event.locals.user, 'users.write');
		const card = await getUserCard(db, actor, event.params.id);
		if (!card?.email) error(404, 'Not found');
		await mailPasswordLink(card.email);
		await writeAudit(db, {
			actorId: actor.id,
			action: 'user.password_link',
			entityType: 'user',
			entityId: card.id,
			ip: event.getClientAddress()
		});
		return { saved: true as const, mailed: true as const };
	}
};
