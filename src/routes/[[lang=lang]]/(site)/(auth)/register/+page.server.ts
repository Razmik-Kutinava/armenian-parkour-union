import { fail, redirect } from '@sveltejs/kit';
import { localizePath } from '#lib/i18n/locales.ts';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { register } from '#lib/server/auth/register.ts';
import { registerSchema } from '#lib/validation/auth.ts';
import { fieldErrors, keepValues } from '#lib/validation/form.ts';
import type { Actions } from './$types';

const FIELDS = [
	'email',
	'firstName',
	'lastName',
	'birthDate',
	'terms',
	'guardianName',
	'guardianPhone',
	'guardianEmail'
] as const;

const failures: Record<string, { status: number; message: MessageKey }> = {
	exists: { status: 400, message: 'auth.error.exists' },
	limited: { status: 429, message: 'auth.error.limited' }
};

export const actions: Actions = {
	default: async (event) => {
		const form = await event.request.formData();
		const values = keepValues(form, FIELDS);
		const parsed = registerSchema().safeParse(Object.fromEntries(form));
		if (!parsed.success) return fail(400, { values, errors: fieldErrors(parsed.error) });

		const { locale } = event.locals;
		const ip = event.getClientAddress();
		const result = await register(parsed.data, locale, ip, event.request.headers);
		if (result !== 'ok') {
			const { status, message } = failures[result];
			return fail(status, { values, message });
		}
		redirect(303, localizePath('/', locale));
	}
};
