import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { eq } from 'drizzle-orm';
import { building } from '$app/env';
import { BETTER_AUTH_SECRET, PUBLIC_SITE_URL } from '$app/env/private';
import { getRequestEvent } from '$app/server';
import { localizePath } from '#lib/i18n/locales.ts';
import { translate, type MessageKey } from '#lib/i18n/translate.ts';
import { PASSWORD_MAX, PASSWORD_MIN } from '#lib/validation/auth.ts';
import { db } from '../db';
import { account, session, users, verification } from '../db/schema';
import { sendMail } from '../mail';

if (!BETTER_AUTH_SECRET && !building) throw new Error('BETTER_AUTH_SECRET is not set');

export const ACCOUNT_BLOCKED = 'ACCOUNT_BLOCKED';

/** Mail in the language of the page the request came from; link to our own page with the token. */
async function mailLink(to: string, path: string, token: string, kind: 'verify' | 'reset') {
	const { locals, url } = getRequestEvent();
	const base = PUBLIC_SITE_URL ?? url.origin;
	const link = `${base}${localizePath(path, locals.locale)}?token=${encodeURIComponent(token)}`;
	const text = (key: MessageKey) => translate(locals.locale, key, { url: link });
	await sendMail({ to, subject: text(`mail.${kind}.subject`), text: text(`mail.${kind}.text`) });
}

const optionalText = { type: 'string', required: false, input: true } as const;

/*
 * The HTTP handler (/api/auth/*) is not mounted: every call goes through form actions with Zod
 * validation, so parent data and consent cannot be skipped. Attempt limits: ./rate-limit.ts.
 */
export const auth = betterAuth({
	baseURL: PUBLIC_SITE_URL,
	secret: BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema: { user: users, session, account, verification }
	}),
	advanced: { database: { generateId: 'uuid' } },
	rateLimit: { enabled: false },
	user: {
		fields: { image: 'avatarKey' },
		additionalFields: {
			firstName: optionalText,
			lastName: optionalText,
			birthDate: optionalText,
			guardianName: optionalText,
			guardianPhone: optionalText,
			guardianEmail: optionalText,
			locale: optionalText,
			termsAcceptedAt: { type: 'date', required: false, input: true }
		}
	},
	emailAndPassword: {
		enabled: true,
		minPasswordLength: PASSWORD_MIN,
		maxPasswordLength: PASSWORD_MAX,
		autoSignIn: true,
		revokeSessionsOnPasswordReset: true,
		sendResetPassword: ({ user, token }) => mailLink(user.email, '/reset-password', token, 'reset')
	},
	emailVerification: {
		sendOnSignUp: true,
		sendVerificationEmail: ({ user, token }) =>
			mailLink(user.email, '/verify-email', token, 'verify')
	},
	databaseHooks: {
		session: {
			create: {
				/* docs/03 section 1.5: a blocked or deleted user cannot get a session. */
				before: async (s) => {
					const [user] = await db
						.select({ status: users.status, deletedAt: users.deletedAt })
						.from(users)
						.where(eq(users.id, s.userId));
					if (!user || user.status === 'blocked' || user.deletedAt) {
						throw new APIError('FORBIDDEN', { code: ACCOUNT_BLOCKED, message: 'Account blocked' });
					}
				}
			}
		}
	},
	plugins: [sveltekitCookies(getRequestEvent)]
});
