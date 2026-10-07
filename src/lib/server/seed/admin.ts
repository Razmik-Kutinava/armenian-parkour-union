import type { LimitDb } from '../auth/rate-limit';

export type SeedAdminResult = 'skipped_no_env' | 'skipped_admin_exists' | 'created' | 'promoted';

export async function seedAdmin(
	_db: LimitDb,
	_input: { email?: string; password?: string }
): Promise<SeedAdminResult> {
	throw new Error('not implemented');
}
