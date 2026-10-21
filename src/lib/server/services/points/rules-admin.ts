import { isDeepStrictEqual } from 'node:util';
import { asc, eq } from 'drizzle-orm';
import type { LocalizedText } from '#lib/i18n/localized.ts';
import { ruleValuesSchema, type RuleValues } from '#lib/validation/admin-point-rules.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { pointsRules } from '../../db/schema/points';
import { users } from '../../db/schema/users';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';
import type { PointsAdminDeps } from './support';

/* docs/05 section 13: rules are edited, never created or deleted here — codes are bound to services. */

export type AdminRule = {
	id: string;
	code: string;
	title: LocalizedText;
	points: number;
	isActive: boolean;
	updatedAt: Date;
	/** null: never changed in the admin (seed). */
	updatedByName: string | null;
};

const columns = {
	id: pointsRules.id,
	code: pointsRules.code,
	title: pointsRules.title,
	points: pointsRules.points,
	isActive: pointsRules.isActive,
	updatedAt: pointsRules.updatedAt,
	updatedByName: users.name
};

const asRule = (row: { title: unknown } & Omit<AdminRule, 'title'>): AdminRule => ({
	...row,
	title: row.title as LocalizedText
});

function rulesQuery(db: LimitDb) {
	return db
		.select(columns)
		.from(pointsRules)
		.leftJoin(users, eq(users.id, pointsRules.updatedBy))
		.$dynamic();
}

export async function listRules(db: LimitDb): Promise<AdminRule[]> {
	return (await rulesQuery(db).orderBy(asc(pointsRules.code))).map(asRule);
}

export async function getRule(db: LimitDb, id: string): Promise<AdminRule | null> {
	if (!isUuid(id)) return null;
	const [row] = await rulesQuery(db).where(eq(pointsRules.id, id));
	return row ? asRule(row) : null;
}

export type RuleUpdateResult = 'ok' | 'not_found' | 'not_allowed' | 'invalid';

/**
 * docs/03 section 6.2 p. 4: only future awards take the new values — entries keep their points.
 * Admin only (docs/04: `points.rules`); only the changed fields go to audit_log; no change, no entry.
 */
export async function updateRule(
	db: LimitDb,
	actor: Actor,
	id: string,
	values: RuleValues,
	deps: PointsAdminDeps
): Promise<RuleUpdateResult> {
	if (!roleCan(actor.role, 'points.rules')) return 'not_allowed';
	const parsed = ruleValuesSchema.safeParse(values);
	if (!parsed.success) return 'invalid';
	if (!isUuid(id)) return 'not_found';
	const next = parsed.data;
	return db.transaction(async (tx): Promise<RuleUpdateResult> => {
		const [row] = await tx.select().from(pointsRules).where(eq(pointsRules.id, id)).for('update');
		if (!row) return 'not_found';
		const before: Partial<RuleValues> = {};
		const after: Partial<RuleValues> = {};
		for (const key of ['title', 'points', 'isActive'] as const) {
			if (isDeepStrictEqual(row[key], next[key])) continue;
			Object.assign(before, { [key]: row[key] });
			Object.assign(after, { [key]: next[key] });
		}
		if (Object.keys(after).length === 0) return 'ok';
		await tx
			.update(pointsRules)
			.set({ ...after, updatedBy: actor.id })
			.where(eq(pointsRules.id, id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'points.rule_update',
			entityType: 'points_rule',
			entityId: id,
			before,
			after,
			ip: deps.ip
		});
		return 'ok';
	});
}
