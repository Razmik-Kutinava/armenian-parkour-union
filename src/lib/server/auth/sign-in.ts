import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { ACCOUNT_BLOCKED, auth } from '.';
import { consume, isLimited, limits } from './rate-limit';

export type SignInResult = 'ok' | 'invalid' | 'blocked' | 'limited';

/** docs/04 section 6.7: editor, moderator and admin get a stricter limit on failed attempts. */
export async function signIn(
	input: { email: string; password: string },
	ip: string,
	headers: Headers
): Promise<SignInResult> {
	if (!(await consume(db, `sign-in:ip:${ip}`, limits.signInPerIp))) return 'limited';

	const [user] = await db
		.select({ role: users.role })
		.from(users)
		.where(eq(users.email, input.email))
		.limit(1);
	const staffKey = user && user.role !== 'member' ? `sign-in:staff:${input.email}:${ip}` : null;
	if (staffKey && (await isLimited(db, staffKey, limits.staffSignInFailures))) return 'limited';

	try {
		await auth.api.signInEmail({ body: input, headers });
		return 'ok';
	} catch (error) {
		if (!(error instanceof APIError)) throw error;
		if (error.body?.code === ACCOUNT_BLOCKED) return 'blocked';
		if (staffKey) await consume(db, staffKey, limits.staffSignInFailures);
		return 'invalid';
	}
}

export async function signOut(headers: Headers): Promise<void> {
	await auth.api.signOut({ headers });
}
