import { error, fail } from '@sveltejs/kit';
import type { MessageKey } from '#lib/i18n/translate.ts';
import type { AccountResult } from '#lib/server/services/users/account.ts';
import type { DeletionResult } from '#lib/server/services/users/deletion.ts';

const refusals: Record<'self' | 'last_admin' | 'not_requested', MessageKey> = {
	self: 'users.error.self',
	last_admin: 'users.error.lastAdmin',
	not_requested: 'users.error.notRequested'
};

/** Action answer for an account change: 404 / 403 without details, rule refusals as a message. */
export function accountOutcome(result: AccountResult | DeletionResult) {
	if (result === 'not_found') error(404, 'Not found');
	if (result === 'not_admin') error(403, 'Forbidden');
	if (result === 'ok') return { saved: true as const };
	return fail(400, { message: refusals[result] });
}
