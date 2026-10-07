import { fail } from '@sveltejs/kit';
import { requestPasswordReset } from '#lib/server/auth/password.ts';
import { forgotPasswordSchema } from '#lib/validation/auth.ts';
import { fieldErrors, keepValues } from '#lib/validation/form.ts';
import { redirectIfSignedIn } from '../guest';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => redirectIfSignedIn(locals);

export const actions: Actions = {
	default: async (event) => {
		const form = await event.request.formData();
		const values = keepValues(form, ['email']);
		const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(form));
		if (!parsed.success) return fail(400, { values, errors: fieldErrors(parsed.error) });

		const result = await requestPasswordReset(parsed.data.email, event.getClientAddress());
		if (result === 'limited') return fail(429, { values, message: 'auth.error.limited' as const });
		return { sent: true };
	}
};
