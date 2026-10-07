import { APIError } from 'better-auth/api';
import { db } from '../db';
import { auth } from '.';
import { consume, limits } from './rate-limit';

/** Same answer whether or not the email exists, so accounts cannot be discovered. */
export async function requestPasswordReset(email: string, ip: string): Promise<'ok' | 'limited'> {
	if (!(await consume(db, `password-reset:ip:${ip}`, limits.passwordResetPerIp))) return 'limited';
	await auth().api.requestPasswordReset({ body: { email } });
	return 'ok';
}

/** Admin panel (docs/05 section 6): "reset" mail, or "set a password" for a user without one. */
export async function mailPasswordLink(email: string): Promise<void> {
	await auth().api.requestPasswordReset({ body: { email } });
}

/** Ends every session of the user (revokeSessionsOnPasswordReset, docs/04 section 6.8). */
export async function resetPassword(token: string, password: string): Promise<'ok' | 'invalid'> {
	try {
		await auth().api.resetPassword({ body: { token, newPassword: password } });
		return 'ok';
	} catch (error) {
		if (error instanceof APIError) return 'invalid';
		throw error;
	}
}

export async function verifyEmail(token: string): Promise<'ok' | 'invalid'> {
	try {
		await auth().api.verifyEmail({ query: { token } });
		return 'ok';
	} catch (error) {
		if (error instanceof APIError) return 'invalid';
		throw error;
	}
}
