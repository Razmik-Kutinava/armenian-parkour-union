import type { LimitDb } from '../../auth/rate-limit';
import type { Actor } from '../users/target';
import type { PointsAdminDeps, PointsAdminResult } from './adjust';

export type ReverseInput = { entryId: string; comment: string };

export async function reverseEntry(
	db: LimitDb,
	actor: Actor,
	input: ReverseInput,
	deps: PointsAdminDeps
): Promise<PointsAdminResult> {
	void db;
	void actor;
	void input;
	void deps;
	throw new Error('not implemented');
}
