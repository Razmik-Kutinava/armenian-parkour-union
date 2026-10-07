import { fail, redirect } from '@sveltejs/kit';
import { localizePath } from '#lib/i18n/locales.ts';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { safeReturnTo } from '#lib/server/auth/return-to.ts';
import { signIn } from '#lib/server/auth/sign-in.ts';
import { signInSchema } from '#lib/validation/auth.ts';
import { fieldErrors, keepValues } from '#lib/validation/form.ts';
import { redirectIfSignedIn } from '../guest';
import type { Actions, PageServerLoad } from './$types';

const failures: Record<string, { status: number; message: MessageKey }> = {
	invalid: { status: 400, message: 'auth.error.invalid' },
	blocked: { status: 403, message: 'auth.error.blocked' },
	limited: { status: 429, message: 'auth.error.limited' }
};

export const load: PageServerLoad = ({ url, locals }) => {
	redirectIfSignedIn(locals);
	return { returnTo: safeReturnTo(url.searchParams.get('returnTo'), '') };
};

export const actions: Actions = {
	default: async (event) => {
		const form = await event.request.formData();
		const values = keepValues(form, ['email']);
		const parsed = signInSchema.safeParse(Object.fromEntries(form));
		if (!parsed.success) return fail(400, { values, errors: fieldErrors(parsed.error) });

		const result = await signIn(parsed.data, event.getClientAddress(), event.request.headers);
		if (result !== 'ok') {
			const { status, message } = failures[result];
			return fail(status, { values, message });
		}
		const home = localizePath('/', event.locals.locale);
		redirect(303, safeReturnTo(String(form.get('returnTo') ?? ''), home));
	}
};
