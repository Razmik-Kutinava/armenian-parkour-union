import { auth } from '.';
import type { AccountCalls } from './account';

/** Better Auth endpoints for the user of the request's session cookie. */
export function accountCalls(headers: Headers, email: string): AccountCalls {
	return {
		changeEmail: async (newEmail) => {
			await auth().api.changeEmail({ body: { newEmail }, headers });
		},
		changePassword: async (currentPassword, newPassword) => {
			await auth().api.changePassword({
				body: { currentPassword, newPassword, revokeOtherSessions: true },
				headers
			});
		},
		sendVerification: async () => {
			await auth().api.sendVerificationEmail({ body: { email }, headers });
		}
	};
}
