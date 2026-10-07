import type { LimitDb } from '../auth/rate-limit';

export const SEED_SETTINGS: Record<string, unknown> = {};

export async function seedSettings(_db: LimitDb): Promise<string[]> {
	throw new Error('not implemented');
}
