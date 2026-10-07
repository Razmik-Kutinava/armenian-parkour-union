import { redirect } from '@sveltejs/kit';
import { localizePath } from '#lib/i18n/locales.ts';
import { signOut } from '#lib/server/auth/sign-in.ts';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async (event) => {
		await signOut(event.request.headers);
		redirect(303, localizePath('/', event.locals.locale));
	}
};
