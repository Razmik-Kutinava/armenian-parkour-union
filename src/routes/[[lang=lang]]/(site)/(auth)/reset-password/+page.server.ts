import { fail } from '@sveltejs/kit';
import { resetPassword } from '#lib/server/auth/password.ts';
import { resetPasswordSchema } from '#lib/validation/auth.ts';
import { fieldErrors } from '#lib/validation/form.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => ({ token: url.searchParams.get('token') ?? '' });

export const actions: Actions = {
	default: async (event) => {
		const form = await event.request.formData();
		const parsed = resetPasswordSchema.safeParse(Object.fromEntries(form));
		if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error) });

		const result = await resetPassword(parsed.data.token, parsed.data.password);
		if (result === 'invalid') return fail(400, { message: 'auth.linkInvalid' as const });
		return { done: true };
	}
};
