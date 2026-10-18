import { fail, redirect } from '@sveltejs/kit';
import { localizePath } from '#lib/i18n/locales.ts';
import { completeProfile, profileDraft } from '#lib/server/auth/complete-profile.ts';
import { db } from '#lib/server/db/index.ts';
import { fieldErrors, keepValues } from '#lib/validation/form.ts';
import { completeProfileSchema } from '#lib/validation/profile.ts';
import type { Actions, PageServerLoad } from './$types';

const FIELDS = [
	'firstName',
	'lastName',
	'birthDate',
	'terms',
	'guardianName',
	'guardianPhone',
	'guardianEmail'
] as const;

/** Signed in through Google and no consent yet (hooks.server.ts); anyone else has nothing to do here. */
function requireIncomplete(locals: App.Locals) {
	const home = localizePath('/', locals.locale);
	if (!locals.user) redirect(303, localizePath('/login', locals.locale));
	if (!locals.needsProfile) redirect(303, home);
	return { user: locals.user, home };
}

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = requireIncomplete(locals);
	return { draft: await profileDraft(db, user.id) };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const { user, home } = requireIncomplete(locals);
		const form = await request.formData();
		const values = keepValues(form, FIELDS);
		const parsed = completeProfileSchema().safeParse(Object.fromEntries(form));
		if (!parsed.success) return fail(400, { values, errors: fieldErrors(parsed.error) });

		await completeProfile(db, user.id, parsed.data, locals.locale);
		redirect(303, home);
	}
};
