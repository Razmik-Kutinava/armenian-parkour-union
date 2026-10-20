import { APIError } from 'better-auth/api';
import { consume, limits, type LimitDb } from './rate-limit';

/** Better Auth calls for the signed-in user (bound to the request in ./account-calls.ts). */
export type AccountCalls = {
	changeEmail: (newEmail: string) => Promise<void>;
	changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
	sendVerification: () => Promise<void>;
};

const codeOf = (error: unknown) => (error instanceof APIError ? error.body?.code : undefined);

/**
 * docs/06 section 5.2: the link goes to the new address; the email changes only when it is opened.
 * A taken address gets the same answer (Better Auth sends nothing), so accounts are not revealed.
 */
export async function requestEmailChange(
	db: LimitDb,
	user: { id: string; email: string },
	newEmail: string,
	calls: AccountCalls
): Promise<'ok' | 'same' | 'limited'> {
	if (newEmail === user.email) return 'same';
	if (!(await consume(db, `email-change:user:${user.id}`, limits.emailChangePerUser))) {
		return 'limited';
	}
	await calls.changeEmail(newEmail);
	return 'ok';
}

/** docs/04 section 6.8: the binding ends every other session of the user. */
export async function changeOwnPassword(
	db: LimitDb,
	userId: string,
	input: { currentPassword: string; newPassword: string },
	calls: AccountCalls
): Promise<'ok' | 'invalid' | 'no_password' | 'limited'> {
	if (!(await consume(db, `password-change:user:${userId}`, limits.passwordChangePerUser))) {
		return 'limited';
	}
	try {
		await calls.changePassword(input.currentPassword, input.newPassword);
		return 'ok';
	} catch (error) {
		const code = codeOf(error);
		if (code === 'INVALID_PASSWORD') return 'invalid';
		if (code === 'CREDENTIAL_ACCOUNT_NOT_FOUND') return 'no_password';
		throw error;
	}
}

/** The confirmation letter again, to the email of the session (docs/06 section 2). */
export async function resendVerification(
	db: LimitDb,
	user: { id: string; emailVerified: boolean },
	calls: AccountCalls
): Promise<'ok' | 'already' | 'limited'> {
	if (user.emailVerified) return 'already';
	if (!(await consume(db, `verify-resend:user:${user.id}`, limits.verifyResendPerUser))) {
		return 'limited';
	}
	try {
		await calls.sendVerification();
		return 'ok';
	} catch (error) {
		if (codeOf(error) === 'EMAIL_ALREADY_VERIFIED') return 'already';
		throw error;
	}
}
