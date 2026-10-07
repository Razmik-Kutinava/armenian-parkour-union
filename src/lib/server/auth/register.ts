import { APIError } from 'better-auth/api';
import type { Locale } from '#lib/i18n/locales.ts';
import { isMinor, type Registration } from '#lib/validation/auth.ts';
import { db } from '../db';
import { auth } from '.';
import { consume, limits } from './rate-limit';

export type RegisterResult = 'ok' | 'exists' | 'limited';

/** docs/06 section 4.11. Parent data is stored only for minors (docs/03 section 13). */
export async function register(
	data: Registration,
	locale: Locale,
	ip: string,
	headers: Headers
): Promise<RegisterResult> {
	if (!(await consume(db, `sign-up:ip:${ip}`, limits.signUpPerIp))) return 'limited';

	const guardian = isMinor(data.birthDate, new Date())
		? {
				guardianName: data.guardianName,
				guardianPhone: data.guardianPhone,
				guardianEmail: data.guardianEmail
			}
		: {};

	try {
		await auth().api.signUpEmail({
			body: {
				email: data.email,
				password: data.password,
				name: `${data.firstName} ${data.lastName}`,
				firstName: data.firstName,
				lastName: data.lastName,
				birthDate: data.birthDate,
				locale,
				termsAcceptedAt: new Date(),
				...guardian
			},
			headers
		});
		return 'ok';
	} catch (error) {
		if (error instanceof APIError && String(error.body?.code).startsWith('USER_ALREADY_EXISTS')) {
			return 'exists';
		}
		throw error;
	}
}
