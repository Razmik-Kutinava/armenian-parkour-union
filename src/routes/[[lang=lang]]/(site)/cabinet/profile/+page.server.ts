import { error, fail } from '@sveltejs/kit';
import { countryOptions } from '#lib/countries.ts';
import { changeOwnPassword, requestEmailChange } from '#lib/server/auth/account.ts';
import { accountCalls } from '#lib/server/auth/account-calls.ts';
import { requireUser } from '#lib/server/auth/guard.ts';
import { requestPasswordReset } from '#lib/server/auth/password.ts';
import { db } from '#lib/server/db/index.ts';
import { getOwnProfile, updateOwnProfile } from '#lib/server/services/cabinet/profile.ts';
import { publicUrl } from '#lib/server/storage/r2.ts';
import {
	emailChangeSchema,
	ownProfileSchema,
	passwordChangeSchema
} from '#lib/validation/cabinet.ts';
import { fieldErrors, keepValues } from '#lib/validation/form.ts';
import type { Actions, PageServerLoad } from './$types';
import { avatarActions } from './avatar-actions';

/* docs/06 section 5.2: own profile only (docs/04 section 5.3); birth date is shown, not edited. */

const PROFILE_FIELDS = [
	'firstName',
	'lastName',
	'phone',
	'country',
	'city',
	'bio',
	'locale',
	'guardianName',
	'guardianPhone',
	'guardianEmail'
] as const;

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals.user);
	const profile = await getOwnProfile(db, user.id);
	if (!profile) error(404);
	const avatarUrl = profile.avatarKey ? publicUrl(profile.avatarKey) : null;
	return { profile, avatarUrl, countries: countryOptions(locals.locale) };
};

export const actions: Actions = {
	...avatarActions,

	save: async ({ locals, request }) => {
		const user = requireUser(locals.user);
		const profile = await getOwnProfile(db, user.id);
		if (!profile) error(404);
		const form = await request.formData();
		const values = keepValues(form, PROFILE_FIELDS);
		const parsed = ownProfileSchema(profile.minor).safeParse(Object.fromEntries(form));
		if (!parsed.success) {
			return fail(400, { profile: { errors: fieldErrors(parsed.error), values } });
		}
		const result = await updateOwnProfile(db, user.id, parsed.data);
		if (result === 'not_found') error(404);
		if (result === 'guardian_required') {
			return fail(400, {
				profile: { errors: { guardianName: 'auth.error.required' as const }, values }
			});
		}
		return { profile: { saved: true } };
	},

	email: async ({ locals, request }) => {
		const user = requireUser(locals.user);
		const form = await request.formData();
		const parsed = emailChangeSchema.safeParse(Object.fromEntries(form));
		const value = String(form.get('newEmail') ?? '');
		if (!parsed.success) return fail(400, { email: { error: 'auth.error.email' as const, value } });
		const { newEmail } = parsed.data;
		const calls = accountCalls(request.headers, user.email);
		const result = await requestEmailChange(db, user, newEmail, calls);
		if (result === 'same')
			return fail(400, { email: { error: 'cabinet.email.same' as const, value } });
		if (result === 'limited') {
			return fail(429, { email: { error: 'cabinet.error.limited' as const, value } });
		}
		return { email: { sentTo: newEmail } };
	},

	password: async ({ locals, request }) => {
		const user = requireUser(locals.user);
		const form = await request.formData();
		const parsed = passwordChangeSchema.safeParse(Object.fromEntries(form));
		if (!parsed.success) return fail(400, { password: { errors: fieldErrors(parsed.error) } });
		const calls = accountCalls(request.headers, user.email);
		const result = await changeOwnPassword(db, user.id, parsed.data, calls);
		if (result === 'invalid') {
			return fail(400, {
				password: { errors: { currentPassword: 'cabinet.password.wrong' as const } }
			});
		}
		if (result === 'limited') {
			return fail(429, { password: { errors: { form: 'cabinet.error.limited' as const } } });
		}
		if (result === 'no_password') {
			return fail(400, { password: { errors: { form: 'cabinet.password.none' as const } } });
		}
		return { password: { changed: true } };
	},

	/** A Google-only account: the "set a password" letter (same limit as "forgot password"). */
	setupPassword: async ({ locals, getClientAddress }) => {
		const user = requireUser(locals.user);
		const result = await requestPasswordReset(user.email, getClientAddress());
		if (result === 'limited') return fail(429, { setup: 'cabinet.error.limited' as const });
		return { setup: 'cabinet.password.setupSent' as const };
	}
};
