import { error } from '@sveltejs/kit';
import { translate } from '#lib/i18n/translate.ts';
import { verifyEmail } from '#lib/server/auth/password.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	const token = url.searchParams.get('token');
	const result = token ? await verifyEmail(token) : 'invalid';
	if (result === 'invalid') error(400, translate(locals.locale, 'auth.linkInvalid'));
	return {};
};
