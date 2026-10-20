import { APIError } from 'better-auth/api';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { insertUser, testDb, testDbUrl } from '../db/test-db';
import {
	changeOwnPassword,
	requestEmailChange,
	resendVerification,
	type AccountCalls
} from './account';
import { limits } from './rate-limit';

/* docs/06 section 5.2: email change with confirmation, password change; docs/04 section 6.8: other
 * sessions end. Attempts are limited per user; answers do not reveal other accounts. */

function calls(extra: Partial<AccountCalls> = {}): AccountCalls {
	return {
		changeEmail: vi.fn(async () => {}),
		changePassword: vi.fn(async () => {}),
		sendVerification: vi.fn(async () => {}),
		...extra
	};
}

const apiError = (code: string) => new APIError('BAD_REQUEST', { code, message: code });

describe('auth: limits for the cabinet', () => {
	it('email change and resend — 3 an hour, password — 5 in 15 minutes', () => {
		expect(limits.emailChangePerUser).toEqual({ windowMs: 60 * 60_000, max: 3 });
		expect(limits.verifyResendPerUser).toEqual({ windowMs: 60 * 60_000, max: 3 });
		expect(limits.passwordChangePerUser).toEqual({ windowMs: 15 * 60_000, max: 5 });
	});
});

describe.skipIf(!testDbUrl)('auth: own account from the cabinet', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('email change: the link goes out for a new address; the same address is refused', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx);
			const c = calls();
			expect(await requestEmailChange(tx, user, user.email, c)).toBe('same');
			expect(c.changeEmail).not.toHaveBeenCalled();
			expect(await requestEmailChange(tx, user, 'new.address@example.com', c)).toBe('ok');
			expect(c.changeEmail).toHaveBeenCalledWith('new.address@example.com');
		});
	});

	it('email change: the fourth request in an hour is limited, the call is not made', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx);
			const c = calls();
			for (let i = 0; i < 3; i++) {
				expect(await requestEmailChange(tx, user, `n${i}@example.com`, c)).toBe('ok');
			}
			expect(await requestEmailChange(tx, user, 'n4@example.com', c)).toBe('limited');
			expect(c.changeEmail).toHaveBeenCalledTimes(3);
			const other = await insertUser(tx);
			expect(await requestEmailChange(tx, other, 'x@example.com', c)).toBe('ok');
		});
	});

	it('password: ok, wrong current password, no password (Google account)', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx);
			const input = { currentPassword: 'old-pass-1', newPassword: 'new-pass-12' };
			const ok = calls();
			expect(await changeOwnPassword(tx, user.id, input, ok)).toBe('ok');
			expect(ok.changePassword).toHaveBeenCalledWith('old-pass-1', 'new-pass-12');
			const wrong = calls({
				changePassword: async () => Promise.reject(apiError('INVALID_PASSWORD'))
			});
			expect(await changeOwnPassword(tx, user.id, input, wrong)).toBe('invalid');
			const none = calls({
				changePassword: async () => Promise.reject(apiError('CREDENTIAL_ACCOUNT_NOT_FOUND'))
			});
			expect(await changeOwnPassword(tx, user.id, input, none)).toBe('no_password');
		});
	});

	it('password: the sixth attempt in 15 minutes is limited; unknown errors are thrown', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx);
			const input = { currentPassword: 'guess', newPassword: 'new-pass-12' };
			const wrong = calls({
				changePassword: async () => Promise.reject(apiError('INVALID_PASSWORD'))
			});
			for (let i = 0; i < 5; i++) {
				expect(await changeOwnPassword(tx, user.id, input, wrong)).toBe('invalid');
			}
			expect(await changeOwnPassword(tx, user.id, input, wrong)).toBe('limited');
			const other = await insertUser(tx);
			const broken = calls({ changePassword: async () => Promise.reject(new Error('db down')) });
			await expect(changeOwnPassword(tx, other.id, input, broken)).rejects.toThrow('db down');
		});
	});

	it('resend the confirmation letter: already confirmed — no letter; limited after 3', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx);
			const c = calls();
			expect(await resendVerification(tx, { id: user.id, emailVerified: true }, c)).toBe('already');
			expect(c.sendVerification).not.toHaveBeenCalled();
			const unverified = { id: user.id, emailVerified: false };
			for (let i = 0; i < 3; i++) expect(await resendVerification(tx, unverified, c)).toBe('ok');
			expect(await resendVerification(tx, unverified, c)).toBe('limited');
			expect(c.sendVerification).toHaveBeenCalledTimes(3);
		});
	});

	it('resend: Better Auth says "already verified" — the same answer', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx);
			const c = calls({
				sendVerification: async () => Promise.reject(apiError('EMAIL_ALREADY_VERIFIED'))
			});
			expect(await resendVerification(tx, { id: user.id, emailVerified: false }, c)).toBe(
				'already'
			);
		});
	});
});
