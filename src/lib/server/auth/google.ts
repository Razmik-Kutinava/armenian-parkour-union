import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '$app/env/private';
import type { Locale } from '#lib/i18n/locales.ts';
import { localizePath } from '#lib/i18n/locales.ts';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { db } from '../db';
import { auth, ACCOUNT_BLOCKED } from '.';
import { consume, limits } from './rate-limit';

export const googleEnabled = () => Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

/** Google sign-in URL; null when attempts from this address are used up. */
export async function startGoogle(
	returnTo: string,
	locale: Locale,
	ip: string,
	headers: Headers
): Promise<string | null> {
	if (!(await consume(db, `sign-in:ip:${ip}`, limits.signInPerIp))) return null;
	const { url } = await auth().api.signInSocial({
		body: {
			provider: 'google',
			callbackURL: returnTo,
			newUserCallbackURL: localizePath('/complete-profile', locale),
			errorCallbackURL: localizePath('/login', locale)
		},
		headers
	});
	if (!url) throw new Error('Google sign-in returned no URL');
	return url;
}

/** Message for `?error=` that the callback puts on /login; the raw code is never shown. */
export function googleErrorMessage(code: string | null): MessageKey | null {
	if (!code) return null;
	if (code === ACCOUNT_BLOCKED) return 'auth.error.blocked';
	if (code === 'limited') return 'auth.error.limited';
	if (code === 'account_not_linked') return 'auth.google.notLinked';
	return 'auth.google.failed';
}
