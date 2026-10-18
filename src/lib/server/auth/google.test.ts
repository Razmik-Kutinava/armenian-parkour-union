import { describe, expect, it } from 'vitest';
import { googleErrorMessage } from './google';

describe('googleErrorMessage (error from the Google callback in /login?error=)', () => {
	it('no error — no message', () => {
		expect(googleErrorMessage(null)).toBeNull();
		expect(googleErrorMessage('')).toBeNull();
	});

	it('blocked account', () => {
		expect(googleErrorMessage('ACCOUNT_BLOCKED')).toBe('auth.error.blocked');
	});

	it('email taken by an account with an unconfirmed email', () => {
		expect(googleErrorMessage('account_not_linked')).toBe('auth.google.notLinked');
	});

	it('anything else is a generic failure, the raw code is never shown', () => {
		expect(googleErrorMessage('state_not_found')).toBe('auth.google.failed');
		expect(googleErrorMessage('<script>')).toBe('auth.google.failed');
	});
});
