import type { LimitDb } from '../../auth/rate-limit';
import type { Actor } from '../users/target';

export type AdjustInput = { userId: string; delta: number; comment: string };
export type PointsAdminDeps = { ip: string | null };
export type PointsAdminResult =
	| { ok: true; entryId: string; balance: number }
	| {
			ok: false;
			reason:
				| 'not_allowed'
				| 'invalid'
				| 'not_found'
				| 'insufficient_balance'
				| 'not_reversible'
				| 'already_reversed';
	  };

export async function adjustPoints(
	db: LimitDb,
	actor: Actor,
	input: AdjustInput,
	deps: PointsAdminDeps
): Promise<PointsAdminResult> {
	void db;
	void actor;
	void input;
	void deps;
	throw new Error('not implemented');
}
