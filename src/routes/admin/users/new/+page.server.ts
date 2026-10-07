import { error, fail, redirect } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { mailPasswordLink } from '#lib/server/auth/password.ts';
import { db } from '#lib/server/db/index.ts';
import { createUser } from '#lib/server/services/users/edit.ts';
import { createUserSchema } from '#lib/validation/admin-users.ts';
import { fieldErrors, keepValues } from '#lib/validation/form.ts';
import type { Actions, PageServerLoad } from './$types';

const FIELDS = [
	'email',
	'firstName',
	'lastName',
	'birthDate',
	'phone',
	'city',
	'guardianName',
	'guardianPhone',
	'guardianEmail'
] as const;

export const load: PageServerLoad = ({ locals }) => {
	requirePermission(locals.user, 'users.write');
};

export const actions: Actions = {
	default: async (event) => {
		const actor = requirePermission(event.locals.user, 'users.write');
		const form = await event.request.formData();
		const values = keepValues(form, FIELDS);
		const parsed = createUserSchema().safeParse(Object.fromEntries(form));
		if (!parsed.success) return fail(400, { values, errors: fieldErrors(parsed.error) });

		const result = await createUser(db, actor, parsed.data, event.getClientAddress());
		if (!result.ok && result.error === 'exists') {
			return fail(400, { values, errors: { email: 'auth.error.exists' as const } });
		}
		if (!result.ok) error(403, 'Forbidden');
		// docs/05 section 6: the new user sets a password from the mailed link
		await mailPasswordLink(parsed.data.email);
		redirect(303, `/admin/users/${result.id}?created=1`);
	}
};
